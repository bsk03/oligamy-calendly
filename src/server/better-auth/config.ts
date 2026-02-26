import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

import { db } from "@/server/db";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const trustedOrigins = [
	...(process.env.NODE_ENV !== "production"
		? ["http://localhost:3000", "http://127.0.0.1:3000"]
		: []),
	...(appUrl ? [appUrl] : []),
];

export const auth = betterAuth({
	trustedOrigins,
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60, // 1 hour
		},
	},
	plugins: [
		admin({
			defaultRole: "user",
			adminRoles: ["admin"],
		}),
	],
});

export type Session = typeof auth.$Infer.Session;
