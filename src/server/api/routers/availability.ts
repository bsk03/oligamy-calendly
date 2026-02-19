import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { availability, availabilityOverride } from "@/server/db/schema";

const weeklySlotSchema = z.object({
	dayOfWeek: z.number().int().min(0).max(6),
	startTime: z.string().regex(/^\d{2}:\d{2}$/),
	endTime: z.string().regex(/^\d{2}:\d{2}$/),
	isAvailable: z.boolean(),
});

export const availabilityRouter = createTRPCRouter({
	getWeekly: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(availability)
			.where(eq(availability.userId, ctx.session.user.id))
			.orderBy(availability.dayOfWeek);
	}),

	setWeekly: protectedProcedure
		.input(z.array(weeklySlotSchema).min(7).max(7))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			await ctx.db
				.delete(availability)
				.where(eq(availability.userId, userId));

			await ctx.db.insert(availability).values(
				input.map((slot) => ({
					userId,
					dayOfWeek: slot.dayOfWeek,
					startTime: slot.startTime,
					endTime: slot.endTime,
					isAvailable: slot.isAvailable,
				})),
			);
		}),

	getOverrides: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(availabilityOverride)
			.where(eq(availabilityOverride.userId, ctx.session.user.id))
			.orderBy(availabilityOverride.date);
	}),

	createOverride: protectedProcedure
		.input(
			z.object({
				date: z.string(), // "YYYY-MM-DD"
				isAvailable: z.boolean(),
				startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
				endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
				reason: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Upsert by userId + date
			const existing = await ctx.db
				.select({ id: availabilityOverride.id })
				.from(availabilityOverride)
				.where(
					and(
						eq(availabilityOverride.userId, ctx.session.user.id),
						eq(availabilityOverride.date, input.date),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				await ctx.db
					.update(availabilityOverride)
					.set({
						isAvailable: input.isAvailable,
						startTime: input.startTime,
						endTime: input.endTime,
						reason: input.reason,
					})
					.where(eq(availabilityOverride.id, existing[0]!.id));
			} else {
				await ctx.db.insert(availabilityOverride).values({
					userId: ctx.session.user.id,
					date: input.date,
					isAvailable: input.isAvailable,
					startTime: input.startTime,
					endTime: input.endTime,
					reason: input.reason,
				});
			}
		}),

	deleteOverride: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(availabilityOverride)
				.where(
					and(
						eq(availabilityOverride.id, input.id),
						eq(availabilityOverride.userId, ctx.session.user.id),
					),
				);
		}),
});
