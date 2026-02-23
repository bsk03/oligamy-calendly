import { and, eq, ne } from "drizzle-orm";
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
	group,
	profile,
	user,
} from "@/server/db/schema";

export const profileRouter = createTRPCRouter({
	get: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const [u] = await ctx.db
			.select({ name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		const _name = u?.name ?? "";

		const [existing] = await ctx.db
			.select()
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		if (existing) return { ...existing, _name };

		return {
			userId,
			username: null as string | null,
			bio: null as string | null,
			avatarUrl: null as string | null,
			timezone: "Europe/Warsaw",
			isVisibleOnHome: false,
			defaultLocale: "en" as string,
			bookingWindowMode: "relative" as string,
			bookingWindowDays: 30,
			bookingWindowEndDate: null as string | null,
			createdAt: new Date(),
			updatedAt: new Date(),
			_name,
			_exists: false as const,
		};
	}),

	update: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100).optional(),
				username: z.string()
					.min(3)
					.max(40)
					.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.")
					.nullable()
					.optional(),
				bio: z.string().max(300).optional(),
				timezone: z.string().min(1),
				isVisibleOnHome: z.boolean(),
				bookingWindowMode: z.enum(["relative", "absolute"]).optional(),
				bookingWindowDays: z.number().int().min(1).max(365).optional(),
				bookingWindowEndDate: z.string().nullable().optional(), // "YYYY-MM-DD" or null
			defaultLocale: z.enum(["en", "pl"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Check username uniqueness
			if (input.username) {
				const [conflict] = await ctx.db
					.select({ userId: profile.userId })
					.from(profile)
					.where(
						and(
							eq(profile.username, input.username),
							ne(profile.userId, userId),
						),
					)
					.limit(1);

				if (conflict) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "This username is already taken.",
					});
				}

				// Check username doesn't conflict with a group slug
				const [groupConflict] = await ctx.db
					.select({ id: group.id })
					.from(group)
					.where(eq(group.slug, input.username))
					.limit(1);

				if (groupConflict) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "This username conflicts with an existing group.",
					});
				}
			}

			// Update user name if provided
			if (input.name) {
				await ctx.db
					.update(user)
					.set({ name: input.name, updatedAt: new Date() })
					.where(eq(user.id, userId));
			}

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
				...(input.defaultLocale !== undefined && {
					defaultLocale: input.defaultLocale,
				}),
			};

			const usernameField = input.username !== undefined
				? { username: input.username }
				: {};

			if (existing) {
				await ctx.db
					.update(profile)
					.set({
						bio: input.bio ?? null,
						timezone: input.timezone,
						isVisibleOnHome: input.isVisibleOnHome,
						...usernameField,
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
					...usernameField,
					...bookingWindowFields,
				});
			}

			return { success: true };
		}),

	setupStatus: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// 1. Profile exists + visible + has username
		const [p] = await ctx.db
			.select({
				isVisibleOnHome: profile.isVisibleOnHome,
				username: profile.username,
			})
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);

		const hasProfile = !!p && p.isVisibleOnHome;
		const hasUsername = !!p?.username;

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
			hasUsername,
			hasProfile,
			hasEventTypes,
			hasAvailability,
			hasGoogleCalendar,
			isComplete: hasUsername && hasProfile && hasEventTypes && hasAvailability,
		};
	}),

	checkUsername: protectedProcedure
		.input(z.object({ username: z.string().min(3).max(40) }))
		.query(async ({ ctx, input }) => {
			const [existing] = await ctx.db
				.select({ userId: profile.userId })
				.from(profile)
				.where(
					and(
						eq(profile.username, input.username),
						ne(profile.userId, ctx.session.user.id),
					),
				)
				.limit(1);

			return { available: !existing };
		}),
});
