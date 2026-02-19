import { and, eq, gt } from "drizzle-orm";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";
import { InvitationStatus, invitation, user } from "@/server/db/schema";
import { sendInvitationEmail } from "@/server/lib/email";
import { auth } from "@/server/better-auth";

export const invitationRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		if (ctx.session.user.role !== "admin") {
			throw new TRPCError({ code: "FORBIDDEN" });
		}

		return ctx.db
			.select()
			.from(invitation)
			.orderBy(invitation.createdAt);
	}),

	create: protectedProcedure
		.input(z.object({ email: z.email() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.session.user.role !== "admin") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			// Check if user with this email already exists
			const existingUser = await ctx.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, input.email))
				.limit(1);

			if (existingUser.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A user with this email already exists.",
				});
			}

			// Check if there's already a pending invite
			const existingInvite = await ctx.db
				.select({ id: invitation.id })
				.from(invitation)
				.where(
					and(
						eq(invitation.email, input.email),
						eq(invitation.status, InvitationStatus.PENDING),
						gt(invitation.expiresAt, new Date()),
					),
				)
				.limit(1);

			if (existingInvite.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A pending invitation for this email already exists.",
				});
			}

			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + 7);

			const [created] = await ctx.db
				.insert(invitation)
				.values({
					email: input.email,
					invitedBy: ctx.session.user.id,
					expiresAt,
				})
				.returning();

			await sendInvitationEmail(input.email, created!.token);

			return created;
		}),

	// Public — validate token for the register page
	getByToken: publicProcedure
		.input(z.object({ token: z.string() }))
		.query(async ({ ctx, input }) => {
			const [inv] = await ctx.db
				.select({
					id: invitation.id,
					email: invitation.email,
					status: invitation.status,
					expiresAt: invitation.expiresAt,
				})
				.from(invitation)
				.where(eq(invitation.token, input.token))
				.limit(1);

			if (!inv) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Invalid invitation link.",
				});
			}

			if (inv.status !== InvitationStatus.PENDING) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This invitation has already been used.",
				});
			}

			if (new Date() > inv.expiresAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This invitation has expired.",
				});
			}

			return { email: inv.email };
		}),

	// Public — register via invitation
	acceptInvitation: publicProcedure
		.input(
			z.object({
				token: z.string(),
				name: z.string().min(1).max(100),
				password: z.string().min(8),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [inv] = await ctx.db
				.select()
				.from(invitation)
				.where(eq(invitation.token, input.token))
				.limit(1);

			if (!inv || inv.status !== InvitationStatus.PENDING || new Date() > inv.expiresAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid or expired invitation.",
				});
			}

			await auth.api.signUpEmail({
				body: {
					name: input.name,
					email: inv.email,
					password: input.password,
				},
			});

			// Apply the role from the invitation (e.g. "admin")
			if (inv.role !== "user") {
				await ctx.db
					.update(user)
					.set({ role: inv.role })
					.where(eq(user.email, inv.email));
			}

			await ctx.db
				.update(invitation)
				.set({ status: "ACCEPTED" })
				.where(eq(invitation.id, inv.id));

			return { email: inv.email };
		}),
});
