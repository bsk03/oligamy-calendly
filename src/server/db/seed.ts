import { env } from "@/env";
import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

async function seed() {
	const existing = await db.select({ id: user.id }).from(user).limit(1);

	if (existing.length > 0) {
		console.log("User already exists — skipping seed.");
		process.exit(0);
	}

	await auth.api.signUpEmail({
		body: {
			name: "Admin",
			email: env.ADMIN_EMAIL,
			password: env.ADMIN_PASSWORD,
		},
	});

	console.log(`Seeded admin user: ${env.ADMIN_EMAIL}`);
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
