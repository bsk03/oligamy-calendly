import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

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

export const teamRouter = createTRPCRouter({
	/** All registered users with their setup status (visible to everyone logged in) */
	list: protectedProcedure.query(async ({ ctx }) => {
		const users = await ctx.db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				role: user.role,
			})
			.from(user)
			.orderBy(user.name);

		if (users.length === 0) return [];

		const userIds = users.map((u) => u.id);

		// Fetch profiles
		const profiles = await ctx.db
			.select()
			.from(profile)
			.where(inArray(profile.userId, userIds));

		const profileMap = new Map(profiles.map((p) => [p.userId, p]));

		// Fetch event type counts (active)
		const eventTypes = await ctx.db
			.select({ userId: eventType.userId, id: eventType.id })
			.from(eventType)
			.where(
				and(
					inArray(eventType.userId, userIds),
					eq(eventType.isActive, true),
				),
			);

		const etCountMap = new Map<string, number>();
		for (const et of eventTypes) {
			etCountMap.set(et.userId, (etCountMap.get(et.userId) ?? 0) + 1);
		}

		// Fetch availability counts
		const availabilities = await ctx.db
			.select({ userId: availability.userId, id: availability.id })
			.from(availability)
			.where(
				and(
					inArray(availability.userId, userIds),
					eq(availability.isAvailable, true),
				),
			);

		const availCountMap = new Map<string, number>();
		for (const a of availabilities) {
			availCountMap.set(a.userId, (availCountMap.get(a.userId) ?? 0) + 1);
		}

		// Fetch google calendar tokens
		const gcalTokens = await ctx.db
			.select({ userId: googleCalendarToken.userId })
			.from(googleCalendarToken)
			.where(inArray(googleCalendarToken.userId, userIds));

		const gcalSet = new Set(gcalTokens.map((t) => t.userId));

		return users.map((u) => {
			const p = profileMap.get(u.id);
			return {
				id: u.id,
				name: u.name,
				email: u.email,
				image: u.image,
				role: u.role,
				avatarUrl: p?.avatarUrl ?? null,
				isVisibleOnHome: p?.isVisibleOnHome ?? false,
				hasProfile: !!p,
				hasEventTypes: (etCountMap.get(u.id) ?? 0) > 0,
				hasAvailability: (availCountMap.get(u.id) ?? 0) > 0,
				hasGoogleCalendar: gcalSet.has(u.id),
			};
		});
	}),

	/** Admin-only: toggle visibility on booking page */
	toggleVisibility: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				isVisibleOnHome: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			// Check that user has a profile
			const [p] = await ctx.db
				.select({ userId: profile.userId })
				.from(profile)
				.where(eq(profile.userId, input.userId))
				.limit(1);

			if (!p) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "User must configure their profile first.",
				});
			}

			await ctx.db
				.update(profile)
				.set({
					isVisibleOnHome: input.isVisibleOnHome,
					updatedAt: new Date(),
				})
				.where(eq(profile.userId, input.userId));

			return { success: true };
		}),

	/** Admin-only: change a user's role */
	setRole: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				role: z.enum(["user", "admin"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			if (ctx.session.user.id === input.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot change your own role.",
				});
			}

			await ctx.db
				.update(user)
				.set({ role: input.role })
				.where(eq(user.id, input.userId));

			return { success: true };
		}),
});
