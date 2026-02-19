import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { availability, availabilityOverride } from "@/server/db/schema";

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number) as [number, number];
	return h * 60 + m;
}

function rangesOverlap(ranges: { startTime: string; endTime: string }[]): boolean {
	if (ranges.length < 2) return false;
	const sorted = ranges
		.map((r) => ({ start: timeToMinutes(r.startTime), end: timeToMinutes(r.endTime) }))
		.sort((a, b) => a.start - b.start);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i]!.start < sorted[i - 1]!.end) return true;
	}
	return false;
}

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
		.input(z.array(weeklySlotSchema).min(7))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Validate no overlapping ranges per day
			const byDay = new Map<number, { startTime: string; endTime: string }[]>();
			for (const slot of input) {
				if (!slot.isAvailable) continue;
				const arr = byDay.get(slot.dayOfWeek) ?? [];
				arr.push({ startTime: slot.startTime, endTime: slot.endTime });
				byDay.set(slot.dayOfWeek, arr);
			}
			for (const [, ranges] of byDay) {
				if (rangesOverlap(ranges)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Time ranges within the same day must not overlap.",
					});
				}
			}

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

	setOverride: protectedProcedure
		.input(
			z.object({
				date: z.string(), // "YYYY-MM-DD"
				isAvailable: z.boolean(),
				ranges: z.array(
					z.object({
						startTime: z.string().regex(/^\d{2}:\d{2}$/),
						endTime: z.string().regex(/^\d{2}:\d{2}$/),
					}),
				),
				reason: z.string().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			if (input.isAvailable && rangesOverlap(input.ranges)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Time ranges must not overlap.",
				});
			}

			// Delete all existing overrides for this date
			await ctx.db
				.delete(availabilityOverride)
				.where(
					and(
						eq(availabilityOverride.userId, userId),
						eq(availabilityOverride.date, input.date),
					),
				);

			if (!input.isAvailable) {
				// Insert single unavailable row
				await ctx.db.insert(availabilityOverride).values({
					userId,
					date: input.date,
					isAvailable: false,
					startTime: null,
					endTime: null,
					reason: input.reason,
				});
			} else {
				// Insert one row per range
				await ctx.db.insert(availabilityOverride).values(
					input.ranges.map((range) => ({
						userId,
						date: input.date,
						isAvailable: true,
						startTime: range.startTime,
						endTime: range.endTime,
						reason: input.reason,
					})),
				);
			}
		}),

	deleteOverride: protectedProcedure
		.input(z.object({ date: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(availabilityOverride)
				.where(
					and(
						eq(availabilityOverride.userId, ctx.session.user.id),
						eq(availabilityOverride.date, input.date),
					),
				);
		}),
});
