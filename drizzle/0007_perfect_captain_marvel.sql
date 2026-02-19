ALTER TABLE "pg-drizzle_profile" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "pg-drizzle_profile" ADD CONSTRAINT "pg-drizzle_profile_username_unique" UNIQUE("username");