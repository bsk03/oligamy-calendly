DROP INDEX "availability_override_user_date_idx";--> statement-breakpoint
CREATE INDEX "availability_override_user_date_idx" ON "pg-drizzle_availability_override" USING btree ("userId","date");