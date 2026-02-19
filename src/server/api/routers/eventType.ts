import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { eventType } from "@/server/db/schema";

function slugify(text: string) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export const eventTypeRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(eventType)
			.where(eq(eventType.userId, ctx.session.user.id))
			.orderBy(eventType.createdAt);
	}),

	create: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1).max(100),
				durationMinutes: z.number().int().min(5).max(480),
				minimumNoticeHours: z.number().int().min(0).max(168).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const slug = slugify(input.title);

			const [created] = await ctx.db
				.insert(eventType)
				.values({
					userId: ctx.session.user.id,
					title: input.title,
					slug,
					durationMinutes: input.durationMinutes,
					minimumNoticeHours: input.minimumNoticeHours ?? 24,
				})
				.returning();

			return created;
		}),

	toggleActive: protectedProcedure
		.input(z.object({ id: z.string(), isActive: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(eventType)
				.set({ isActive: input.isActive, updatedAt: new Date() })
				.where(
					and(
						eq(eventType.id, input.id),
						eq(eventType.userId, ctx.session.user.id),
					),
				);
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				minimumNoticeHours: z.number().int().min(0).max(168),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.update(eventType)
				.set({
					minimumNoticeHours: input.minimumNoticeHours,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(eventType.id, input.id),
						eq(eventType.userId, ctx.session.user.id),
					),
				);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(eventType)
				.where(
					and(
						eq(eventType.id, input.id),
						eq(eventType.userId, ctx.session.user.id),
					),
				);
		}),
});
