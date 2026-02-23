import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import {
	group,
	groupEventType,
	groupMember,
	profile,
	user,
} from "@/server/db/schema";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const groupRouter = createTRPCRouter({
	/** List all groups with member count + host name (admin only) */
	list: protectedProcedure.query(async ({ ctx }) => {
		if (ctx.session.user.role !== "admin") {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		const groups = await ctx.db
			.select({
				id: group.id,
				name: group.name,
				slug: group.slug,
				description: group.description,
				hostUserId: group.hostUserId,
				hostName: user.name,
				isActive: group.isActive,
				createdAt: group.createdAt,
			})
			.from(group)
			.innerJoin(user, eq(group.hostUserId, user.id))
			.orderBy(group.name);

		// Fetch member counts
		const memberCounts = await ctx.db
			.select({
				groupId: groupMember.groupId,
				count: sql<number>`count(*)::int`,
			})
			.from(groupMember)
			.groupBy(groupMember.groupId);

		const countMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));

		return groups.map((g) => ({
			...g,
			memberCount: countMap.get(g.id) ?? 0,
		}));
	}),

	/** Get group by ID with full details (admin only) */
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const [g] = await ctx.db
				.select()
				.from(group)
				.where(eq(group.id, input.id))
				.limit(1);

			if (!g) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Host info
			const [host] = await ctx.db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
				})
				.from(user)
				.where(eq(user.id, g.hostUserId))
				.limit(1);

			// Members
			const members = await ctx.db
				.select({
					id: groupMember.id,
					userId: groupMember.userId,
					name: user.name,
					email: user.email,
					image: user.image,
					avatarUrl: profile.avatarUrl,
				})
				.from(groupMember)
				.innerJoin(user, eq(groupMember.userId, user.id))
				.leftJoin(profile, eq(groupMember.userId, profile.userId))
				.where(eq(groupMember.groupId, input.id))
				.orderBy(user.name);

			// Event types
			const eventTypes = await ctx.db
				.select()
				.from(groupEventType)
				.where(eq(groupEventType.groupId, input.id))
				.orderBy(groupEventType.title);

			return {
				...g,
				host,
				members,
				eventTypes,
			};
		}),

	/** Create a new group (admin only) */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(3)
					.max(40)
					.regex(slugRegex, "Only lowercase letters, numbers, and hyphens."),
				description: z.string().max(500).optional(),
				hostUserId: z.string(),
				timezone: z.string().min(1).optional(),
				bookingWindowMode: z.enum(["relative", "absolute"]).optional(),
				bookingWindowDays: z.number().int().min(1).max(365).optional(),
				bookingWindowEndDate: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			// Check slug uniqueness against groups
			const [existingGroup] = await ctx.db
				.select({ id: group.id })
				.from(group)
				.where(eq(group.slug, input.slug))
				.limit(1);

			if (existingGroup) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A group with this slug already exists.",
				});
			}

			// Check slug doesn't collide with username
			const [existingProfile] = await ctx.db
				.select({ userId: profile.userId })
				.from(profile)
				.where(eq(profile.username, input.slug))
				.limit(1);

			if (existingProfile) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This slug conflicts with an existing username.",
				});
			}

			// Verify host exists
			const [hostUser] = await ctx.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.id, input.hostUserId))
				.limit(1);

			if (!hostUser) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Host user not found.",
				});
			}

			const [created] = await ctx.db
				.insert(group)
				.values({
					name: input.name,
					slug: input.slug,
					description: input.description ?? null,
					hostUserId: input.hostUserId,
					createdBy: ctx.session.user.id,
					...(input.timezone ? { timezone: input.timezone } : {}),
					...(input.bookingWindowMode
						? { bookingWindowMode: input.bookingWindowMode }
						: {}),
					...(input.bookingWindowDays !== undefined
						? { bookingWindowDays: input.bookingWindowDays }
						: {}),
					...(input.bookingWindowEndDate !== undefined
						? { bookingWindowEndDate: input.bookingWindowEndDate }
						: {}),
				})
				.returning();

			return created;
		}),

	/** Update a group (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				slug: z
					.string()
					.min(3)
					.max(40)
					.regex(slugRegex, "Only lowercase letters, numbers, and hyphens.")
					.optional(),
				description: z.string().max(500).nullable().optional(),
				hostUserId: z.string().optional(),
				isActive: z.boolean().optional(),
				timezone: z.string().min(1).optional(),
				bookingWindowMode: z.enum(["relative", "absolute"]).optional(),
				bookingWindowDays: z.number().int().min(1).max(365).optional(),
				bookingWindowEndDate: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			// Check slug uniqueness if changing
			if (input.slug) {
				const [existingGroup] = await ctx.db
					.select({ id: group.id })
					.from(group)
					.where(and(eq(group.slug, input.slug), ne(group.id, input.id)))
					.limit(1);

				if (existingGroup) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A group with this slug already exists.",
					});
				}

				const [existingProfile] = await ctx.db
					.select({ userId: profile.userId })
					.from(profile)
					.where(eq(profile.username, input.slug))
					.limit(1);

				if (existingProfile) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "This slug conflicts with an existing username.",
					});
				}
			}

			const { id, ...updates } = input;
			await ctx.db
				.update(group)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(group.id, id));

			return { success: true };
		}),

	/** Delete a group (admin only) */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			await ctx.db.delete(group).where(eq(group.id, input.id));
			return { success: true };
		}),

	/** Add a member to a group (admin only) */
	addMember: protectedProcedure
		.input(z.object({ groupId: z.string(), userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			// Check user exists
			const [u] = await ctx.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.id, input.userId))
				.limit(1);

			if (!u) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
			}

			// Check not already a member
			const [existing] = await ctx.db
				.select({ id: groupMember.id })
				.from(groupMember)
				.where(
					and(
						eq(groupMember.groupId, input.groupId),
						eq(groupMember.userId, input.userId),
					),
				)
				.limit(1);

			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "User is already a member of this group.",
				});
			}

			const [created] = await ctx.db
				.insert(groupMember)
				.values({
					groupId: input.groupId,
					userId: input.userId,
				})
				.returning();

			return created;
		}),

	/** Remove a member from a group (admin only) */
	removeMember: protectedProcedure
		.input(z.object({ groupId: z.string(), userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			await ctx.db
				.delete(groupMember)
				.where(
					and(
						eq(groupMember.groupId, input.groupId),
						eq(groupMember.userId, input.userId),
					),
				);

			return { success: true };
		}),

	/** Create a group event type (admin only) */
	createEventType: protectedProcedure
		.input(
			z.object({
				groupId: z.string(),
				title: z.string().min(1).max(100),
				durationMinutes: z.number().int().min(5).max(480),
				description: z.string().max(500).optional(),
				minimumNoticeHours: z.number().int().min(0).max(168).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const slug = input.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");

			const [created] = await ctx.db
				.insert(groupEventType)
				.values({
					groupId: input.groupId,
					title: input.title,
					slug,
					durationMinutes: input.durationMinutes,
					description: input.description ?? null,
					minimumNoticeHours: input.minimumNoticeHours ?? 24,
				})
				.returning();

			return created;
		}),

	/** Update a group event type (admin only) */
	updateEventType: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).max(100).optional(),
				durationMinutes: z.number().int().min(5).max(480).optional(),
				description: z.string().max(500).nullable().optional(),
				isActive: z.boolean().optional(),
				minimumNoticeHours: z.number().int().min(0).max(168).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const { id, ...updates } = input;

			// Generate new slug if title changes
			const slug = updates.title
				? updates.title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-|-$/g, "")
				: undefined;

			await ctx.db
				.update(groupEventType)
				.set({ ...updates, ...(slug ? { slug } : {}), updatedAt: new Date() })
				.where(eq(groupEventType.id, id));

			return { success: true };
		}),

	/** Delete a group event type (admin only) */
	deleteEventType: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			await ctx.db
				.delete(groupEventType)
				.where(eq(groupEventType.id, input.id));

			return { success: true };
		}),

	/** Public: get group by slug for booking page */
	bySlug: publicProcedure
		.input(z.object({ slug: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const [g] = await ctx.db
				.select()
				.from(group)
				.where(and(eq(group.slug, input.slug), eq(group.isActive, true)))
				.limit(1);

			if (!g) return null;

			// Host info
			const [host] = await ctx.db
				.select({
					id: user.id,
					name: user.name,
					image: user.image,
					avatarUrl: profile.avatarUrl,
					bio: profile.bio,
					defaultLocale: profile.defaultLocale,
				})
				.from(user)
				.leftJoin(profile, eq(user.id, profile.userId))
				.where(eq(user.id, g.hostUserId))
				.limit(1);

			// Members
			const members = await ctx.db
				.select({
					userId: groupMember.userId,
					name: user.name,
					image: user.image,
					avatarUrl: profile.avatarUrl,
				})
				.from(groupMember)
				.innerJoin(user, eq(groupMember.userId, user.id))
				.leftJoin(profile, eq(groupMember.userId, profile.userId))
				.where(eq(groupMember.groupId, g.id))
				.orderBy(user.name);

			// Active event types
			const eventTypes = await ctx.db
				.select({
					id: groupEventType.id,
					title: groupEventType.title,
					slug: groupEventType.slug,
					durationMinutes: groupEventType.durationMinutes,
					description: groupEventType.description,
					color: groupEventType.color,
				})
				.from(groupEventType)
				.where(
					and(
						eq(groupEventType.groupId, g.id),
						eq(groupEventType.isActive, true),
					),
				)
				.orderBy(groupEventType.title);

			return {
				id: g.id,
				name: g.name,
				slug: g.slug,
				description: g.description,
				timezone: g.timezone,
				bookingWindowMode: g.bookingWindowMode,
				bookingWindowDays: g.bookingWindowDays,
				bookingWindowEndDate: g.bookingWindowEndDate,
				host: host ?? null,
				members,
				eventTypes,
			};
		}),
});
