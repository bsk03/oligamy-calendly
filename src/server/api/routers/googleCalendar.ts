import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { googleCalendarToken } from "@/server/db/schema";
import { getAuthUrl } from "@/server/lib/google-calendar";

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
});
