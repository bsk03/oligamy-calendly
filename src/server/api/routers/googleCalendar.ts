import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { googleCalendarToken } from "@/server/db/schema";
import { getAuthUrl, listUserCalendars } from "@/server/lib/google-calendar";
import { getValidTokenById } from "@/server/lib/google-calendar-token";

export const googleCalendarRouter = createTRPCRouter({
	getStatus: protectedProcedure.query(async ({ ctx }) => {
		const tokens = await ctx.db
			.select({
				id: googleCalendarToken.id,
				accountEmail: googleCalendarToken.accountEmail,
				calendarId: googleCalendarToken.calendarId,
				isEventTarget: googleCalendarToken.isEventTarget,
				createdAt: googleCalendarToken.createdAt,
			})
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, ctx.session.user.id));

		return {
			connected: tokens.length > 0,
			accounts: tokens.map((t) => ({
				id: t.id,
				accountEmail: t.accountEmail,
				calendarId: t.calendarId,
				isEventTarget: t.isEventTarget,
				createdAt: t.createdAt,
			})),
		};
	}),

	getAuthUrl: protectedProcedure.query(() => {
		return { url: getAuthUrl() };
	}),

	disconnect: protectedProcedure
		.input(z.object({ tokenId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const [token] = await ctx.db
				.select({
					id: googleCalendarToken.id,
					userId: googleCalendarToken.userId,
					isEventTarget: googleCalendarToken.isEventTarget,
				})
				.from(googleCalendarToken)
				.where(eq(googleCalendarToken.id, input.tokenId))
				.limit(1);

			if (!token || token.userId !== ctx.session.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await ctx.db
				.delete(googleCalendarToken)
				.where(eq(googleCalendarToken.id, input.tokenId));

			// If deleted token was event target, promote the next one
			if (token.isEventTarget) {
				const [next] = await ctx.db
					.select({ id: googleCalendarToken.id })
					.from(googleCalendarToken)
					.where(eq(googleCalendarToken.userId, ctx.session.user.id))
					.limit(1);

				if (next) {
					await ctx.db
						.update(googleCalendarToken)
						.set({ isEventTarget: true, updatedAt: new Date() })
						.where(eq(googleCalendarToken.id, next.id));
				}
			}

			return { success: true };
		}),

	listCalendars: protectedProcedure
		.input(z.object({ tokenId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Verify ownership
			const [rawToken] = await ctx.db
				.select({ userId: googleCalendarToken.userId })
				.from(googleCalendarToken)
				.where(eq(googleCalendarToken.id, input.tokenId))
				.limit(1);

			if (!rawToken || rawToken.userId !== ctx.session.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const token = await getValidTokenById(ctx.db, input.tokenId);

			if (!token) {
				return { calendars: [], selectedCalendarIds: [], eventCalendarId: "" };
			}

			const calendars = await listUserCalendars({
				accessToken: token.accessToken,
				refreshToken: token.refreshToken,
			});

			// Normalize "primary" alias to the actual calendar ID
			const primaryCalendar = calendars.find((c) => c.primary);
			const calendarIdSet = new Set(calendars.map((c) => c.id));
			const normalizeId = (id: string) =>
				id === "primary" && primaryCalendar ? primaryCalendar.id : id;

			const rawSelectedIds = (token.busyCalendarIds ?? ["primary"]).map(normalizeId);
			const rawEventCalendarId = normalizeId(token.calendarId);

			// Filter out calendar IDs that no longer exist in Google
			const validSelectedIds = rawSelectedIds.filter((id) => calendarIdSet.has(id));
			const selectedIds = validSelectedIds.length > 0
				? validSelectedIds
				: [primaryCalendar?.id ?? calendars[0]?.id].filter(Boolean) as string[];

			const eventCalendarId = calendarIdSet.has(rawEventCalendarId)
				? rawEventCalendarId
				: (primaryCalendar?.id ?? calendars[0]?.id ?? rawEventCalendarId);

			// Auto-heal: update DB if stale IDs were removed
			const busyChanged = rawSelectedIds.length !== selectedIds.length;
			const eventChanged = rawEventCalendarId !== eventCalendarId;
			if (busyChanged || eventChanged) {
				await ctx.db
					.update(googleCalendarToken)
					.set({
						...(busyChanged ? { busyCalendarIds: selectedIds } : {}),
						...(eventChanged ? { calendarId: eventCalendarId } : {}),
						updatedAt: new Date(),
					})
					.where(eq(googleCalendarToken.id, token.id));
			}

			return {
				calendars,
				selectedCalendarIds: selectedIds,
				eventCalendarId,
			};
		}),

	updateSelectedCalendars: protectedProcedure
		.input(z.object({ tokenId: z.string(), calendarIds: z.array(z.string()).min(1) }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const [token] = await ctx.db
				.select({ userId: googleCalendarToken.userId })
				.from(googleCalendarToken)
				.where(eq(googleCalendarToken.id, input.tokenId))
				.limit(1);

			if (!token || token.userId !== ctx.session.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await ctx.db
				.update(googleCalendarToken)
				.set({
					busyCalendarIds: input.calendarIds,
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.id, input.tokenId));

			return { success: true };
		}),

	updateEventCalendar: protectedProcedure
		.input(z.object({ tokenId: z.string(), calendarId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const [token] = await ctx.db
				.select({ userId: googleCalendarToken.userId })
				.from(googleCalendarToken)
				.where(eq(googleCalendarToken.id, input.tokenId))
				.limit(1);

			if (!token || token.userId !== ctx.session.user.id) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Reset isEventTarget on all user tokens
			await ctx.db
				.update(googleCalendarToken)
				.set({ isEventTarget: false, updatedAt: new Date() })
				.where(eq(googleCalendarToken.userId, ctx.session.user.id));

			// Set this token as event target with the selected calendar
			await ctx.db
				.update(googleCalendarToken)
				.set({
					isEventTarget: true,
					calendarId: input.calendarId,
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.id, input.tokenId));

			return { success: true };
		}),
});
