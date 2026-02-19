ALTER TABLE "pg-drizzle_profile" ADD COLUMN "bookingWindowMode" text DEFAULT 'relative' NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_profile" ADD COLUMN "bookingWindowDays" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_profile" ADD COLUMN "bookingWindowEndDate" date;