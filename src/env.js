import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().min(32),

		DATABASE_URL: z.string().url(),
		NODE_ENV: z
			.enum(['development', 'test', 'production'])
			.default('development'),

		ADMIN_EMAIL: z.string().email(),

		GOOGLE_CLIENT_ID: z.string(),
		GOOGLE_CLIENT_SECRET: z.string(),
		GOOGLE_REDIRECT_URI: z.string().url(),

		TOKEN_ENCRYPTION_KEY: z.string().length(64),

		GOOGLE_CLIENT_EMAIL: z.string(),
		GOOGLE_PRIVATE_KEY: z.string(),
		GOOGLE_IMPERSONATE_USER: z.string().email(),
		EMAIL_FROM: z.string(),
	},

	client: {
		NEXT_PUBLIC_APP_URL: z.string().url(),
	},

	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		NODE_ENV: process.env.NODE_ENV,
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
		TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
		GOOGLE_IMPERSONATE_USER: process.env.GOOGLE_IMPERSONATE_USER,
		EMAIL_FROM: process.env.EMAIL_FROM,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION && process.env.NODE_ENV !== 'production',
	emptyStringAsUndefined: true,
});
