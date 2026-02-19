ALTER TABLE "pg-drizzle_google_calendar_token" DROP CONSTRAINT "pg-drizzle_google_calendar_token_userId_unique";--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD COLUMN "googleCalendarTokenId" text;--> statement-breakpoint
ALTER TABLE "pg-drizzle_google_calendar_token" ADD COLUMN "accountEmail" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_google_calendar_token" ADD COLUMN "isEventTarget" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD CONSTRAINT "pg-drizzle_booking_googleCalendarTokenId_pg-drizzle_google_calendar_token_id_fk" FOREIGN KEY ("googleCalendarTokenId") REFERENCES "public"."pg-drizzle_google_calendar_token"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gcal_token_user_id_idx" ON "pg-drizzle_google_calendar_token" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "gcal_token_user_account_idx" ON "pg-drizzle_google_calendar_token" USING btree ("userId","accountEmail");--> statement-breakpoint
-- Data migration: existing tokens become event target
UPDATE "pg-drizzle_google_calendar_token" SET "isEventTarget" = true;--> statement-breakpoint
-- Data migration: link existing bookings with their host's Google Calendar token
UPDATE "pg-drizzle_booking" b SET "googleCalendarTokenId" = t.id
FROM "pg-drizzle_google_calendar_token" t
WHERE b."hostId" = t."userId" AND b."googleEventId" IS NOT NULL;