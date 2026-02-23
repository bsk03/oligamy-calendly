import { eq, ne, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
	availability,
	availabilityOverride,
	booking,
	bookingAttendee,
	eventType,
	googleCalendarToken,
	group,
	groupEventType,
	groupMember,
	invitation,
	posts,
	profile,
	user,
	verification,
} from "@/server/db/schema";

async function clean() {
	console.log("Starting database cleanup (keeping admin account)...\n");

	// Find admin user(s)
	const admins = await db
		.select({ id: user.id, email: user.email, name: user.name })
		.from(user)
		.where(eq(user.role, "admin"));

	if (admins.length === 0) {
		console.log("No admin user found! Aborting to prevent data loss.");
		process.exit(1);
	}

	console.log(
		`Found ${admins.length} admin(s):`,
		admins.map((a) => `${a.name} (${a.email})`).join(", "),
	);

	const adminIds = admins.map((a) => a.id);

	// Order matters due to foreign key constraints.
	// We delete explicitly rather than relying solely on CASCADE
	// to ensure clean removal of all domain data (including admin's own data).

	// 1. booking_attendee (references booking + user)
	const deletedAttendees = await db.delete(bookingAttendee).returning({ id: bookingAttendee.id });
	console.log(`Deleted ${deletedAttendees.length} booking attendees`);

	// 2. booking (references event_type without CASCADE, so must go before event_type)
	const deletedBookings = await db.delete(booking).returning({ id: booking.id });
	console.log(`Deleted ${deletedBookings.length} bookings`);

	// 3. event_type
	const deletedEventTypes = await db.delete(eventType).returning({ id: eventType.id });
	console.log(`Deleted ${deletedEventTypes.length} event types`);

	// 4. group_event_type (references group)
	const deletedGroupEventTypes = await db.delete(groupEventType).returning({ id: groupEventType.id });
	console.log(`Deleted ${deletedGroupEventTypes.length} group event types`);

	// 5. group_member (references group + user)
	const deletedGroupMembers = await db.delete(groupMember).returning({ id: groupMember.id });
	console.log(`Deleted ${deletedGroupMembers.length} group members`);

	// 6. group
	const deletedGroups = await db.delete(group).returning({ id: group.id });
	console.log(`Deleted ${deletedGroups.length} groups`);

	// 7. availability
	const deletedAvailability = await db.delete(availability).returning({ id: availability.id });
	console.log(`Deleted ${deletedAvailability.length} availability records`);

	// 8. availability_override
	const deletedOverrides = await db.delete(availabilityOverride).returning({ id: availabilityOverride.id });
	console.log(`Deleted ${deletedOverrides.length} availability overrides`);

	// 9. google_calendar_token
	const deletedTokens = await db.delete(googleCalendarToken).returning({ id: googleCalendarToken.id });
	console.log(`Deleted ${deletedTokens.length} Google Calendar tokens`);

	// 10. profile (keep admin profiles)
	const deletedProfiles = await db
		.delete(profile)
		.where(sql`${profile.userId} NOT IN (${sql.join(adminIds.map((id) => sql`${id}`), sql`, `)})`)
		.returning({ userId: profile.userId });
	console.log(`Deleted ${deletedProfiles.length} profiles`);

	// 11. invitation
	const deletedInvitations = await db.delete(invitation).returning({ id: invitation.id });
	console.log(`Deleted ${deletedInvitations.length} invitations`);

	// 12. posts (legacy)
	const deletedPosts = await db.delete(posts).returning({ id: posts.id });
	console.log(`Deleted ${deletedPosts.length} posts`);

	// 13. verification
	const deletedVerifications = await db.delete(verification).returning({ id: verification.id });
	console.log(`Deleted ${deletedVerifications.length} verifications`);

	// 14. Delete non-admin users (CASCADE cleans up session + account)
	const deletedUsers = await db
		.delete(user)
		.where(ne(user.role, "admin"))
		.returning({ id: user.id, email: user.email });
	console.log(`Deleted ${deletedUsers.length} non-admin users`);

	console.log("\nCleanup complete! Only admin account(s) remain.");
	process.exit(0);
}

clean().catch((err) => {
	console.error("Cleanup failed:", err);
	process.exit(1);
});
