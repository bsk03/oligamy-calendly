ALTER TABLE "pg-drizzle_profile" DROP CONSTRAINT "pg-drizzle_profile_username_unique";--> statement-breakpoint
DROP INDEX "profile_username_idx";--> statement-breakpoint
ALTER TABLE "pg-drizzle_profile" DROP COLUMN "username";