import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
	createTRPCRouter,
	protectedProcedure,
} from "@/server/api/trpc";
import {
	availability,
	eventType,
	googleCalendarToken,
	profile,
	user,
} from "@/server/db/schema";

export const profileRouter = createTRPCRouter({
	get: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const [existing] = await ctx.db
			.select()
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		if (existing) return existing;

		// No profile yet — return defaults from user record
		const [u] = await ctx.db
			.select({ name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return {
			userId,
			bio: null as string | null,
			avatarUrl: null as string | null,
			timezone: "Europe/Warsaw",
			isVisibleOnHome: false,
			bookingWindowMode: "relative" as string,
			bookingWindowDays: 30,
			bookingWindowEndDate: null as string | null,
			createdAt: new Date(),
			updatedAt: new Date(),
			_name: u?.name ?? "",
			_exists: false as const,
		};
	}),

	update: protectedProcedure
		.input(
			z.object({
				bio: z.string().max(300).optional(),
				timezone: z.string().min(1),
				isVisibleOnHome: z.boolean(),
				bookingWindowMode: z.enum(["relative", "absolute"]).optional(),
				bookingWindowDays: z.number().int().min(1).max(365).optional(),
				bookingWindowEndDate: z.string().nullable().optional(), // "YYYY-MM-DD" or null
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Upsert profile
			const [existing] = await ctx.db
				.select({ userId: profile.userId })
				.from(profile)
				.where(eq(profile.userId, userId))
				.limit(1);

			const bookingWindowFields = {
				...(input.bookingWindowMode !== undefined && {
					bookingWindowMode: input.bookingWindowMode,
				}),
				...(input.bookingWindowDays !== undefined && {
					bookingWindowDays: input.bookingWindowDays,
				}),
				...(input.bookingWindowEndDate !== undefined && {
					bookingWindowEndDate: input.bookingWindowEndDate,
				}),
			};

			if (existing) {
				await ctx.db
					.update(profile)
					.set({
						bio: input.bio ?? null,
						timezone: input.timezone,
						isVisibleOnHome: input.isVisibleOnHome,
						...bookingWindowFields,
						updatedAt: new Date(),
					})
					.where(eq(profile.userId, userId));
			} else {
				await ctx.db.insert(profile).values({
					userId,
					bio: input.bio ?? null,
					timezone: input.timezone,
					isVisibleOnHome: input.isVisibleOnHome,
					...bookingWindowFields,
				});
			}

			return { success: true };
		}),

	setupStatus: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// 1. Profile exists + visible
		const [p] = await ctx.db
			.select({
				isVisibleOnHome: profile.isVisibleOnHome,
			})
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		const hasProfile = !!p && p.isVisibleOnHome;

		// 2. At least one active event type
		const [et] = await ctx.db
			.select({ id: eventType.id })
			.from(eventType)
			.where(
				and(
					eq(eventType.userId, userId),
					eq(eventType.isActive, true),
				),
			)
			.limit(1);

		const hasEventTypes = !!et;

		// 3. Availability saved (at least one isAvailable=true record)
		const [avail] = await ctx.db
			.select({ id: availability.id })
			.from(availability)
			.where(
				and(
					eq(availability.userId, userId),
					eq(availability.isAvailable, true),
				),
			)
			.limit(1);

		const hasAvailability = !!avail;

		// 4. Google Calendar connected
		const [gcal] = await ctx.db
			.select({ id: googleCalendarToken.id })
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, userId))
			.limit(1);

		const hasGoogleCalendar = !!gcal;

		return {
			hasProfile,
			hasEventTypes,
			hasAvailability,
			hasGoogleCalendar,
			isComplete: hasProfile && hasEventTypes && hasAvailability,
		};
	}),
});
