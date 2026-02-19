import { z } from "zod/v4";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
	getAvailableDatesForMonth,
	getAvailableSlots,
} from "@/server/lib/availability";

export const slotsRouter = createTRPCRouter({
	getAvailableDates: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				eventTypeId: z.string(),
				year: z.number().int().min(2024).max(2030),
				month: z.number().int().min(1).max(12),
			}),
		)
		.query(async ({ ctx, input }) => {
			return getAvailableDatesForMonth(
				ctx.db,
				input.userId,
				input.eventTypeId,
				input.year,
				input.month,
			);
		}),

	getAvailableSlots: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				eventTypeId: z.string(),
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			}),
		)
		.query(async ({ ctx, input }) => {
			return getAvailableSlots(
				ctx.db,
				input.userId,
				input.eventTypeId,
				input.date,
			);
		}),
});
