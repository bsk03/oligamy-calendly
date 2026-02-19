CREATE TABLE "pg-drizzle_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"invitedBy" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "pg-drizzle_invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "pg-drizzle_invitation" ADD CONSTRAINT "pg-drizzle_invitation_invitedBy_user_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_idx" ON "pg-drizzle_invitation" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "pg-drizzle_invitation" USING btree ("email");