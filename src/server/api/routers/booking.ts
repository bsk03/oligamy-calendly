import { and, desc, eq, gte, lt, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import {
	ACTIVE_BOOKING_STATUSES,
	ALL_BOOKING_STATUSES,
	BookingStatus,
	CalendarResponseStatus,
	booking,
	eventType,
	user,
} from "@/server/db/schema";
import { getGoogleCalendarBusyPeriods } from "@/server/lib/availability";
import {
	acceptCalendarEvent,
	createCalendarEvent,
	declineCalendarEvent,
	getCalendarEventStatus,
} from "@/server/lib/google-calendar";
import { getEventTargetToken, getValidTokenById, getValidTokensByIds } from "@/server/lib/google-calendar-token";

export const bookingRouter = createTRPCRouter({
	/** List bookings. Users see own bookings, admins can filter by hostId. */
	list: protectedProcedure
		.input(
			z.object({
				hostId: z.string().optional(),
			}).optional(),
		)
		.query(async ({ ctx, input }) => {
			const isAdmin = ctx.session.user.role === "admin";
			const targetHostId = isAdmin && input?.hostId
				? input.hostId
				: ctx.session.user.id;

			const bookings = await ctx.db
				.select({
					id: booking.id,
					hostId: booking.hostId,
					guestName: booking.guestName,
					guestEmail: booking.guestEmail,
					guestNotes: booking.guestNotes,
					startTime: booking.startTime,
					endTime: booking.endTime,
					timezone: booking.timezone,
					status: booking.status,
					meetLink: booking.meetLink,
					createdAt: booking.createdAt,
					eventTypeTitle: eventType.title,
					eventTypeDuration: eventType.durationMinutes,
					hostName: user.name,
				})
				.from(booking)
				.innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
				.innerJoin(user, eq(booking.hostId, user.id))
				.where(
					isAdmin && !input?.hostId
						? undefined // admin without filter: all bookings
						: eq(booking.hostId, targetHostId),
				)
				.orderBy(desc(booking.startTime));

			return bookings;
		}),

	/** List all hosts for admin filter dropdown */
	hosts: protectedProcedure.query(async ({ ctx }) => {
		if (ctx.session.user.role !== "admin") {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		// Get distinct hosts that have at least one booking
		const hosts = await ctx.db
			.selectDistinct({
				id: user.id,
				name: user.name,
			})
			.from(booking)
			.innerJoin(user, eq(booking.hostId, user.id))
			.orderBy(user.name);

		return hosts;
	}),

	/** Dashboard stats */
	stats: protectedProcedure.query(async ({ ctx }) => {
		const isAdmin = ctx.session.user.role === "admin";
		const userId = ctx.session.user.id;
		const now = new Date();

		// Upcoming bookings (for user: own, for admin: all)
		const upcomingFilter = isAdmin
			? and(
					gte(booking.startTime, now),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				)
			: and(
					eq(booking.hostId, userId),
					gte(booking.startTime, now),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				);

		const upcoming = await ctx.db
			.select({
				id: booking.id,
				hostId: booking.hostId,
				guestName: booking.guestName,
				guestEmail: booking.guestEmail,
				startTime: booking.startTime,
				endTime: booking.endTime,
				status: booking.status,
				meetLink: booking.meetLink,
				eventTypeTitle: eventType.title,
				hostName: user.name,
			})
			.from(booking)
			.innerJoin(eventType, eq(booking.eventTypeId, eventType.id))
			.innerJoin(user, eq(booking.hostId, user.id))
			.where(upcomingFilter)
			.orderBy(booking.startTime)
			.limit(5);

		// Counts
		const allUpcoming = await ctx.db
			.select({ id: booking.id })
			.from(booking)
			.where(upcomingFilter);

		// Today's bookings
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

		const todayFilter = isAdmin
			? and(
					gte(booking.startTime, todayStart),
					lt(booking.startTime, todayEnd),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				)
			: and(
					eq(booking.hostId, userId),
					gte(booking.startTime, todayStart),
					lt(booking.startTime, todayEnd),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				);

		const todayBookings = await ctx.db
			.select({ id: booking.id })
			.from(booking)
			.where(todayFilter);

		// This week count
		const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
		const weekFilter = isAdmin
			? and(
					gte(booking.startTime, now),
					lt(booking.startTime, weekEnd),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				)
			: and(
					eq(booking.hostId, userId),
					gte(booking.startTime, now),
					lt(booking.startTime, weekEnd),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				);

		const weekBookings = await ctx.db
			.select({ id: booking.id })
			.from(booking)
			.where(weekFilter);

		// Admin-only: total team members, total bookings all time
		let totalMembers = 0;
		let totalBookingsAllTime = 0;
		if (isAdmin) {
			const members = await ctx.db.select({ id: user.id }).from(user);
			totalMembers = members.length;

			const allBookings = await ctx.db.select({ id: booking.id }).from(booking);
			totalBookingsAllTime = allBookings.length;
		}

		return {
			upcoming,
			upcomingCount: allUpcoming.length,
			todayCount: todayBookings.length,
			thisWeekCount: weekBookings.length,
			isAdmin,
			totalMembers,
			totalBookingsAllTime,
		};
	}),

	create: publicProcedure
		.input(
			z.object({
				hostId: z.string(),
				eventTypeId: z.string(),
				startTime: z.string().datetime(),
				endTime: z.string().datetime(),
				timezone: z.string(),
				guestName: z.string().min(1).max(200),
				guestEmail: z.string().email(),
				guestNotes: z.string().max(1000).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify event type belongs to host
			const [et] = await ctx.db
				.select()
				.from(eventType)
				.where(
					and(
						eq(eventType.id, input.eventTypeId),
						eq(eventType.userId, input.hostId),
						eq(eventType.isActive, true),
					),
				)
				.limit(1);

			if (!et) {
				throw new Error("Invalid event type");
			}

			// Check for conflicting bookings (race condition guard)
			const startTime = new Date(input.startTime);
			const endTime = new Date(input.endTime);

			const conflicts = await ctx.db
				.select({ id: booking.id })
				.from(booking)
				.where(
					and(
						eq(booking.hostId, input.hostId),
						inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
						lt(booking.startTime, endTime),
						gte(booking.endTime, startTime),
					),
				)
				.limit(1);

			if (conflicts.length > 0) {
				throw new Error(
					"This time slot is no longer available. Please choose another.",
				);
			}

			// Check Google Calendar for conflicts
			const busyPeriods = await getGoogleCalendarBusyPeriods(
				ctx.db,
				input.hostId,
				startTime,
				endTime,
			);

			const hasCalendarConflict = busyPeriods.some(
				(busy) => startTime < busy.end && endTime > busy.start,
			);

			if (hasCalendarConflict) {
				throw new Error(
					"This time slot is no longer available. Please choose another.",
				);
			}

			// Insert booking
			const [created] = await ctx.db
				.insert(booking)
				.values({
					hostId: input.hostId,
					eventTypeId: input.eventTypeId,
					startTime,
					endTime,
					timezone: input.timezone,
					guestName: input.guestName,
					guestEmail: input.guestEmail,
					guestNotes: input.guestNotes ?? null,
					status: BookingStatus.PENDING,
				})
				.returning({ id: booking.id });

			const bookingId = created!.id;

			// Create Google Calendar event + Meet (if host has calendar connected)
			try {
				const token = await getEventTargetToken(ctx.db, input.hostId);

				if (token) {
					const [host] = await ctx.db
						.select({ email: user.email })
						.from(user)
						.where(eq(user.id, input.hostId))
						.limit(1);

					if (host) {
						const notesLine = input.guestNotes
							? `\n\nNotes from guest:\n${input.guestNotes}`
							: "";

						const eventOpts = {
							accessToken: token.accessToken,
							refreshToken: token.refreshToken,
							calendarId: token.calendarId,
							summary: `${et.title} — ${input.guestName}`,
							description: `Booking with ${input.guestName} (${input.guestEmail})${notesLine}`,
							startTime,
							endTime,
							hostEmail: host.email,
							guestEmail: input.guestEmail,
							guestName: input.guestName,
						};

						let result: Awaited<ReturnType<typeof createCalendarEvent>> = null;
						try {
							result = await createCalendarEvent(eventOpts);
						} catch (calErr) {
							// Fallback to primary if selected calendar no longer exists
							if (token.calendarId !== "primary") {
								console.warn("[booking] Calendar", token.calendarId, "failed, falling back to primary:", calErr);
								result = await createCalendarEvent({ ...eventOpts, calendarId: "primary" });
							} else {
								throw calErr;
							}
						}

						if (result) {
							await ctx.db
								.update(booking)
								.set({
									googleEventId: result.googleEventId,
									googleCalendarTokenId: token.id,
									meetLink: result.meetLink,
									updatedAt: new Date(),
								})
								.where(eq(booking.id, bookingId));

							return { bookingId, meetLink: result.meetLink };
						}
					}
				}
			} catch (err) {
				console.error("[booking] Failed to create calendar event:", err);
			}

			return { bookingId, meetLink: null };
		}),

	/** Confirm attendance for a booking */
	confirm: protectedProcedure
		.input(z.object({ bookingId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [b] = await ctx.db
				.select()
				.from(booking)
				.where(eq(booking.id, input.bookingId))
				.limit(1);

			if (!b) throw new TRPCError({ code: "NOT_FOUND" });

			const isAdmin = ctx.session.user.role === "admin";
			if (b.hostId !== ctx.session.user.id && !isAdmin) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (b.status === BookingStatus.CONFIRMED) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Already confirmed" });
			}

			await ctx.db
				.update(booking)
				.set({ status: BookingStatus.CONFIRMED, updatedAt: new Date() })
				.where(eq(booking.id, input.bookingId));

			// Accept Google Calendar event (set host responseStatus to "accepted")
			if (b.googleEventId) {
				try {
					const token = b.googleCalendarTokenId
						? await getValidTokenById(ctx.db, b.googleCalendarTokenId)
						: await getEventTargetToken(ctx.db, b.hostId);

					if (token) {
						const [host] = await ctx.db
							.select({ email: user.email })
							.from(user)
							.where(eq(user.id, b.hostId))
							.limit(1);

						if (host) {
							await acceptCalendarEvent({
								accessToken: token.accessToken,
								refreshToken: token.refreshToken,
								calendarId: token.calendarId,
								googleEventId: b.googleEventId,
								hostEmail: host.email,
							});
						}
					}
				} catch (err) {
					console.error("[booking] Failed to accept calendar event:", err);
				}
			}

			return { success: true };
		}),

	/** Cancel a booking */
	cancel: protectedProcedure
		.input(z.object({ bookingId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [b] = await ctx.db
				.select()
				.from(booking)
				.where(eq(booking.id, input.bookingId))
				.limit(1);

			if (!b) throw new TRPCError({ code: "NOT_FOUND" });

			const isAdmin = ctx.session.user.role === "admin";
			if (b.hostId !== ctx.session.user.id && !isAdmin) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			if (b.status === BookingStatus.CANCELLED) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Already declined" });
			}

			await ctx.db
				.update(booking)
				.set({ status: BookingStatus.CANCELLED, updatedAt: new Date() })
				.where(eq(booking.id, input.bookingId));

			// Decline Google Calendar event
			if (b.googleEventId) {
				try {
					const token = b.googleCalendarTokenId
						? await getValidTokenById(ctx.db, b.googleCalendarTokenId)
						: await getEventTargetToken(ctx.db, b.hostId);

					if (token) {
						const [host] = await ctx.db
							.select({ email: user.email })
							.from(user)
							.where(eq(user.id, b.hostId))
							.limit(1);

						if (host) {
							await declineCalendarEvent({
								accessToken: token.accessToken,
								refreshToken: token.refreshToken,
								calendarId: token.calendarId,
								googleEventId: b.googleEventId,
								hostEmail: host.email,
							});
						}
					}
				} catch (err) {
					console.error("[booking] Failed to decline calendar event:", err);
				}
			}

			return { success: true };
		}),

	/** Sync booking statuses from Google Calendar responses */
	syncFromCalendar: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const isAdmin = ctx.session.user.role === "admin";

		// Get all upcoming bookings with Google Calendar events
		const upcomingBookings = await ctx.db
			.select()
			.from(booking)
			.where(
				and(
					inArray(booking.status, [...ALL_BOOKING_STATUSES]),
					gte(booking.startTime, new Date()),
					isAdmin ? undefined : eq(booking.hostId, userId),
				),
			);

		const withGoogleEvent = upcomingBookings.filter((b) => b.googleEventId);
		if (withGoogleEvent.length === 0) return { synced: 0 };

		// Collect unique token IDs from bookings (filter nulls)
		const tokenIds = [...new Set(
			withGoogleEvent
				.map((b) => b.googleCalendarTokenId)
				.filter((id): id is string => id !== null),
		)];

		// Fetch tokens by ID for bookings that have a token reference
		const tokenByIdMap = await getValidTokensByIds(ctx.db, tokenIds);

		// For legacy bookings without tokenId, get event target tokens per host
		const hostsNeedingFallback = [...new Set(
			withGoogleEvent
				.filter((b) => !b.googleCalendarTokenId)
				.map((b) => b.hostId),
		)];

		const fallbackTokenMap = new Map<string, Awaited<ReturnType<typeof getEventTargetToken>>>();
		for (const hostId of hostsNeedingFallback) {
			fallbackTokenMap.set(hostId, await getEventTargetToken(ctx.db, hostId));
		}

		// Fetch host emails
		const allHostIds = [...new Set(withGoogleEvent.map((b) => b.hostId))];
		const hosts = await ctx.db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(inArray(user.id, allHostIds));

		const hostMap = new Map(hosts.map((h) => [h.id, h]));

		let synced = 0;

		for (const b of withGoogleEvent) {
			const token = b.googleCalendarTokenId
				? tokenByIdMap.get(b.googleCalendarTokenId)
				: fallbackTokenMap.get(b.hostId);
			const host = hostMap.get(b.hostId);
			if (!token || !host || !b.googleEventId) continue;

			try {
				const status = await getCalendarEventStatus({
					accessToken: token.accessToken,
					refreshToken: token.refreshToken,
					calendarId: token.calendarId,
					googleEventId: b.googleEventId,
					hostEmail: host.email,
				});

				let newStatus: string | null = null;
				if (status === CalendarResponseStatus.ACCEPTED && b.status !== BookingStatus.CONFIRMED) newStatus = BookingStatus.CONFIRMED;
				else if (status === CalendarResponseStatus.DECLINED && b.status !== BookingStatus.CANCELLED) newStatus = BookingStatus.CANCELLED;
				else if (status === CalendarResponseStatus.NEEDS_ACTION && b.status !== BookingStatus.PENDING) newStatus = BookingStatus.PENDING;

				if (newStatus) {
					await ctx.db
						.update(booking)
						.set({ status: newStatus, updatedAt: new Date() })
						.where(eq(booking.id, b.id));
					synced++;
				}
			} catch (err) {
				console.error("[booking] Sync failed for booking:", b.id, err);
			}
		}

		return { synced };
	}),
});
