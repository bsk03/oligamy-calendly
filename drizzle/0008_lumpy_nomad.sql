CREATE TABLE "pg-drizzle_booking_attendee" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"hostUserId" text NOT NULL,
	"createdBy" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "pg-drizzle_group_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_group_event_type" (
	"id" text PRIMARY KEY NOT NULL,
	"groupId" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"durationMinutes" integer NOT NULL,
	"description" text,
	"color" text DEFAULT '#3B82F6',
	"isActive" boolean DEFAULT true NOT NULL,
	"minimumNoticeHours" integer DEFAULT 24 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg-drizzle_group_member" (
	"id" text PRIMARY KEY NOT NULL,
	"groupId" text NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ALTER COLUMN "eventTypeId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD COLUMN "groupId" text;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD COLUMN "groupEventTypeId" text;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking_attendee" ADD CONSTRAINT "pg-drizzle_booking_attendee_bookingId_pg-drizzle_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."pg-drizzle_booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking_attendee" ADD CONSTRAINT "pg-drizzle_booking_attendee_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group" ADD CONSTRAINT "pg-drizzle_group_hostUserId_user_id_fk" FOREIGN KEY ("hostUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group" ADD CONSTRAINT "pg-drizzle_group_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group_event_type" ADD CONSTRAINT "pg-drizzle_group_event_type_groupId_pg-drizzle_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."pg-drizzle_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group_member" ADD CONSTRAINT "pg-drizzle_group_member_groupId_pg-drizzle_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."pg-drizzle_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_group_member" ADD CONSTRAINT "pg-drizzle_group_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_attendee_unique_idx" ON "pg-drizzle_booking_attendee" USING btree ("bookingId","userId");--> statement-breakpoint
CREATE INDEX "booking_attendee_booking_id_idx" ON "pg-drizzle_booking_attendee" USING btree ("bookingId");--> statement-breakpoint
CREATE UNIQUE INDEX "group_slug_idx" ON "pg-drizzle_group" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "group_event_type_slug_idx" ON "pg-drizzle_group_event_type" USING btree ("groupId","slug");--> statement-breakpoint
CREATE INDEX "group_event_type_group_id_idx" ON "pg-drizzle_group_event_type" USING btree ("groupId");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_unique_idx" ON "pg-drizzle_group_member" USING btree ("groupId","userId");--> statement-breakpoint
CREATE INDEX "group_member_group_id_idx" ON "pg-drizzle_group_member" USING btree ("groupId");--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD CONSTRAINT "pg-drizzle_booking_groupId_pg-drizzle_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."pg-drizzle_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg-drizzle_booking" ADD CONSTRAINT "pg-drizzle_booking_groupEventTypeId_pg-drizzle_group_event_type_id_fk" FOREIGN KEY ("groupEventTypeId") REFERENCES "public"."pg-drizzle_group_event_type"("id") ON DELETE set null ON UPDATE no action;