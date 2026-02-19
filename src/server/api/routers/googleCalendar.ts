import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { googleCalendarToken } from "@/server/db/schema";
import {
	getAuthUrl,
	listUserCalendars,
	refreshAccessToken,
} from "@/server/lib/google-calendar";

export const googleCalendarRouter = createTRPCRouter({
	getStatus: protectedProcedure.query(async ({ ctx }) => {
		const token = await ctx.db
			.select({
				id: googleCalendarToken.id,
				calendarId: googleCalendarToken.calendarId,
				createdAt: googleCalendarToken.createdAt,
			})
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, ctx.session.user.id))
			.limit(1);

		return {
			connected: token.length > 0,
			calendarId: token[0]?.calendarId ?? null,
			connectedAt: token[0]?.createdAt ?? null,
		};
	}),

	getAuthUrl: protectedProcedure.query(() => {
		return { url: getAuthUrl() };
	}),

	disconnect: protectedProcedure.mutation(async ({ ctx }) => {
		await ctx.db
			.delete(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, ctx.session.user.id));

		return { success: true };
	}),

	listCalendars: protectedProcedure.query(async ({ ctx }) => {
		const [token] = await ctx.db
			.select()
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, ctx.session.user.id))
			.limit(1);

		if (!token) {
			return { calendars: [], selectedCalendarIds: [] };
		}

		let accessToken = token.accessToken;

		// Refresh token if expired
		if (token.expiresAt < new Date()) {
			const credentials = await refreshAccessToken(token.refreshToken);
			if (credentials.access_token && credentials.expiry_date) {
				accessToken = credentials.access_token;
				await ctx.db
					.update(googleCalendarToken)
					.set({
						accessToken: credentials.access_token,
						expiresAt: new Date(credentials.expiry_date),
						updatedAt: new Date(),
					})
					.where(eq(googleCalendarToken.id, token.id));
			}
		}

		const calendars = await listUserCalendars({
			accessToken,
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
		.input(z.object({ calendarIds: z.array(z.string()).min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(googleCalendarToken)
				.set({
					busyCalendarIds: input.calendarIds,
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.userId, ctx.session.user.id));

			return { success: true };
		}),

	updateEventCalendar: protectedProcedure
		.input(z.object({ calendarId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(googleCalendarToken)
				.set({
					calendarId: input.calendarId,
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.userId, ctx.session.user.id));

			return { success: true };
		}),
});
