import { and, eq, gt } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/server/db";
import { InvitationStatus, invitation, user } from "@/server/db/schema";
import { sendInvitationEmail } from "@/server/lib/email";

async function seed() {
	// Check if a user with this email already exists
	const existingUser = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, env.ADMIN_EMAIL))
		.limit(1);

	if (existingUser.length > 0) {
		console.log("Admin user already exists — skipping seed.");
		process.exit(0);
	}

	// Check if there's already a pending invitation for this email
	const existingInvite = await db
		.select({ id: invitation.id })
		.from(invitation)
		.where(
			and(
				eq(invitation.email, env.ADMIN_EMAIL),
				eq(invitation.status, InvitationStatus.PENDING),
				gt(invitation.expiresAt, new Date()),
			),
		)
		.limit(1);

	if (existingInvite.length > 0) {
		console.log("Pending admin invitation already exists — skipping seed.");
		process.exit(0);
	}

	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);

	const [created] = await db
		.insert(invitation)
		.values({
			email: env.ADMIN_EMAIL,
			invitedBy: null,
			role: "admin",
			expiresAt,
		})
		.returning();

	await sendInvitationEmail(env.ADMIN_EMAIL, created!.token);

	console.log(`Invitation sent to ${env.ADMIN_EMAIL} (role: admin)`);
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
