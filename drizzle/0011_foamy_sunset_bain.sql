ALTER TABLE "pg-drizzle_group" ADD COLUMN "timezone" text DEFAULT 'Europe/Warsaw' NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group" ADD COLUMN "bookingWindowMode" text DEFAULT 'relative' NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group" ADD COLUMN "bookingWindowDays" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group" ADD COLUMN "bookingWindowEndDate" date;