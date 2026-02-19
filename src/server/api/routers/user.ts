import { eq } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { eventType, profile, user } from "@/server/db/schema";

export const userRouter = createTRPCRouter({
	list: publicProcedure.query(async ({ ctx }) => {
		// Get all visible profiles joined with user data
		const profiles = await ctx.db
			.select({
				userId: profile.userId,
				name: user.name,
				image: user.image,
				bio: profile.bio,
				avatarUrl: profile.avatarUrl,
			})
			.from(profile)
			.innerJoin(user, eq(profile.userId, user.id))
			.where(eq(profile.isVisibleOnHome, true));

		if (profiles.length === 0) return [];

		// Fetch active event types for all visible users
		const userIds = profiles.map((p) => p.userId);

		const eventTypes = await ctx.db
			.select({
				id: eventType.id,
				userId: eventType.userId,
				title: eventType.title,
				slug: eventType.slug,
				durationMinutes: eventType.durationMinutes,
				description: eventType.description,
				color: eventType.color,
			})
			.from(eventType)
			.where(eq(eventType.isActive, true));

		// Group event types by userId
		const eventTypesByUser = new Map<string, typeof eventTypes>();
		for (const et of eventTypes) {
			if (!userIds.includes(et.userId)) continue;
			const existing = eventTypesByUser.get(et.userId) ?? [];
			existing.push(et);
			eventTypesByUser.set(et.userId, existing);
		}

		return profiles.map((p) => ({
			...p,
			eventTypes: eventTypesByUser.get(p.userId) ?? [],
		}));
	}),
});
