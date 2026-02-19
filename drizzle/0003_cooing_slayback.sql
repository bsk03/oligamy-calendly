ALTER TABLE "pg-drizzle_invitation" ALTER COLUMN "invitedBy" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_invitation" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;