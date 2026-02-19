import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	pgTableCreator,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

// ── Enums ──

export const BookingStatus = {
	PENDING: "PENDING",
	CONFIRMED: "CONFIRMED",
	CANCELLED: "CANCELLED",
	COMPLETED: "COMPLETED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const ACTIVE_BOOKING_STATUSES = [
	BookingStatus.PENDING,
	BookingStatus.CONFIRMED,
] as const;

export const ALL_BOOKING_STATUSES = [
	BookingStatus.PENDING,
	BookingStatus.CONFIRMED,
	BookingStatus.CANCELLED,
] as const;

export const InvitationStatus = {
	PENDING: "PENDING",
	ACCEPTED: "ACCEPTED",
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const CalendarResponseStatus = {
	NEEDS_ACTION: "needsAction",
	ACCEPTED: "accepted",
	DECLINED: "declined",
	TENTATIVE: "tentative",
} as const;
export type CalendarResponseStatus = (typeof CalendarResponseStatus)[keyof typeof CalendarResponseStatus];

export const posts = createTable(
	"post",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		name: d.varchar({ length: 256 }),
		createdById: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => user.id),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
	}),
	(t) => [
		index("created_by_idx").on(t.createdById),
		index("name_idx").on(t.name),
	],
);

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified")
		.$defaultFn(() => false)
		.notNull(),
	image: text("image"),
	role: text("role").notNull().default("user"),
	banned: boolean("banned"),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	createdAt: timestamp("created_at")
		.$defaultFn(() => /* @__PURE__ */ new Date())
		.notNull(),
	updatedAt: timestamp("updated_at")
		.$defaultFn(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
	updatedAt: timestamp("updated_at").$defaultFn(
		() => /* @__PURE__ */ new Date(),
	),
});

// ─── Domain Tables ───────────────────────────────────────────────

export const profile = createTable(
	"profile",
	(d) => ({
		userId: d
			.text()
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		username: d.text().unique(),
		bio: d.text(),
		avatarUrl: d.text(),
		timezone: d.text().notNull().default("Europe/Warsaw"),
		isVisibleOnHome: d.boolean().notNull().default(true),
		bookingWindowMode: d.text().notNull().default("relative"), // "relative" | "absolute"
		bookingWindowDays: d.integer().notNull().default(30),
		bookingWindowEndDate: d.date(), // only when mode = "absolute"
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	() => [],
);

export const eventType = createTable(
	"event_type",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: d.text().notNull(),
		slug: d.text().notNull(),
		durationMinutes: d.integer().notNull(),
		description: d.text(),
		location: d.text(),
		color: d.text().default("#3B82F6"),
		isActive: d.boolean().notNull().default(true),
		bookingWindowDays: d.integer().notNull().default(30),
		minimumNoticeHours: d.integer().notNull().default(24),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		index("event_type_user_id_idx").on(t.userId),
		uniqueIndex("event_type_user_slug_idx").on(t.userId, t.slug),
	],
);

export const availability = createTable(
	"availability",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		dayOfWeek: d.integer().notNull(), // 0=Sunday … 6=Saturday
		startTime: d.text().notNull(), // "09:00"
		endTime: d.text().notNull(), // "17:00"
		isAvailable: d.boolean().notNull().default(true),
	}),
	(t) => [index("availability_user_id_idx").on(t.userId)],
);

export const availabilityOverride = createTable(
	"availability_override",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		date: d.date().notNull(),
		isAvailable: d.boolean().notNull(),
		startTime: d.text(),
		endTime: d.text(),
		reason: d.text(),
	}),
	(t) => [
		index("availability_override_user_id_idx").on(t.userId),
		index("availability_override_user_date_idx").on(t.userId, t.date),
	],
);

export const booking = createTable(
	"booking",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		hostId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		eventTypeId: d
			.text()
			.references(() => eventType.id),
		groupId: d
			.text()
			.references(() => group.id, { onDelete: "set null" }),
		groupEventTypeId: d
			.text()
			.references(() => groupEventType.id, { onDelete: "set null" }),
		guestName: d.text().notNull(),
		guestEmail: d.text().notNull(),
		guestPhone: d.text(),
		guestNotes: d.text(),
		startTime: d.timestamp({ withTimezone: true }).notNull(),
		endTime: d.timestamp({ withTimezone: true }).notNull(),
		timezone: d.text().notNull(),
		status: d.text().notNull().default(BookingStatus.PENDING),
		googleEventId: d.text(),
		googleCalendarTokenId: d
			.text()
			.references(() => googleCalendarToken.id, { onDelete: "set null" }),
		meetLink: d.text(),
		cancelToken: d
			.text()
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		rescheduleToken: d
			.text()
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		index("booking_host_id_idx").on(t.hostId),
		index("booking_event_type_id_idx").on(t.eventTypeId),
		index("booking_start_time_idx").on(t.startTime),
		index("booking_status_idx").on(t.status),
	],
);

export const googleCalendarToken = createTable(
	"google_calendar_token",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountEmail: d.text().notNull().default("unknown"),
		isEventTarget: d.boolean().notNull().default(false),
		accessToken: d.text().notNull(),
		refreshToken: d.text().notNull(),
		expiresAt: d.timestamp({ withTimezone: true }).notNull(),
		calendarId: d.text().notNull().default("primary"),
		busyCalendarIds: d.text().array().default(["primary"]),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		index("gcal_token_user_id_idx").on(t.userId),
		uniqueIndex("gcal_token_user_account_idx").on(t.userId, t.accountEmail),
	],
);

export const invitation = createTable(
	"invitation",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		email: d.text().notNull(),
		token: d
			.text()
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		invitedBy: d
			.text()
			.references(() => user.id, { onDelete: "cascade" }),
		role: d.text().notNull().default("user"),
		status: d.text().notNull().default(InvitationStatus.PENDING),
		expiresAt: d.timestamp({ withTimezone: true }).notNull(),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		uniqueIndex("invitation_token_idx").on(t.token),
		index("invitation_email_idx").on(t.email),
	],
);

// ─── Group Tables ────────────────────────────────────────────────

export const group = createTable(
	"group",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: d.text().notNull(),
		slug: d.text().notNull().unique(),
		description: d.text(),
		hostUserId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdBy: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		isActive: d.boolean().notNull().default(true),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [uniqueIndex("group_slug_idx").on(t.slug)],
);

export const groupMember = createTable(
	"group_member",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: d
			.text()
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		uniqueIndex("group_member_unique_idx").on(t.groupId, t.userId),
		index("group_member_group_id_idx").on(t.groupId),
	],
);

export const groupEventType = createTable(
	"group_event_type",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: d
			.text()
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		title: d.text().notNull(),
		slug: d.text().notNull(),
		durationMinutes: d.integer().notNull(),
		description: d.text(),
		color: d.text().default("#3B82F6"),
		isActive: d.boolean().notNull().default(true),
		minimumNoticeHours: d.integer().notNull().default(24),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		uniqueIndex("group_event_type_slug_idx").on(t.groupId, t.slug),
		index("group_event_type_group_id_idx").on(t.groupId),
	],
);

export const bookingAttendee = createTable(
	"booking_attendee",
	(d) => ({
		id: d
			.text()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bookingId: d
			.text()
			.notNull()
			.references(() => booking.id, { onDelete: "cascade" }),
		userId: d
			.text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [
		uniqueIndex("booking_attendee_unique_idx").on(t.bookingId, t.userId),
		index("booking_attendee_booking_id_idx").on(t.bookingId),
	],
);

// ─── Relations ───────────────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
	account: many(account),
	session: many(session),
	profile: one(profile),
	eventTypes: many(eventType),
	availabilities: many(availability),
	availabilityOverrides: many(availabilityOverride),
	bookings: many(booking),
	googleCalendarTokens: many(googleCalendarToken),
	groupMemberships: many(groupMember),
	bookingAttendances: many(bookingAttendee),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const profileRelations = relations(profile, ({ one }) => ({
	user: one(user, { fields: [profile.userId], references: [user.id] }),
}));

export const eventTypeRelations = relations(eventType, ({ one, many }) => ({
	user: one(user, { fields: [eventType.userId], references: [user.id] }),
	bookings: many(booking),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
	user: one(user, { fields: [availability.userId], references: [user.id] }),
}));

export const availabilityOverrideRelations = relations(
	availabilityOverride,
	({ one }) => ({
		user: one(user, {
			fields: [availabilityOverride.userId],
			references: [user.id],
		}),
	}),
);

export const bookingRelations = relations(booking, ({ one, many }) => ({
	host: one(user, { fields: [booking.hostId], references: [user.id] }),
	eventType: one(eventType, {
		fields: [booking.eventTypeId],
		references: [eventType.id],
	}),
	group: one(group, {
		fields: [booking.groupId],
		references: [group.id],
	}),
	groupEventType: one(groupEventType, {
		fields: [booking.groupEventTypeId],
		references: [groupEventType.id],
	}),
	googleCalendarToken: one(googleCalendarToken, {
		fields: [booking.googleCalendarTokenId],
		references: [googleCalendarToken.id],
	}),
	attendees: many(bookingAttendee),
}));

export const googleCalendarTokenRelations = relations(
	googleCalendarToken,
	({ one }) => ({
		user: one(user, {
			fields: [googleCalendarToken.userId],
			references: [user.id],
		}),
	}),
);

export const groupRelations = relations(group, ({ one, many }) => ({
	hostUser: one(user, {
		fields: [group.hostUserId],
		references: [user.id],
		relationName: "groupHost",
	}),
	createdByUser: one(user, {
		fields: [group.createdBy],
		references: [user.id],
		relationName: "groupCreator",
	}),
	members: many(groupMember),
	eventTypes: many(groupEventType),
}));

export const groupMemberRelations = relations(groupMember, ({ one }) => ({
	group: one(group, {
		fields: [groupMember.groupId],
		references: [group.id],
	}),
	user: one(user, {
		fields: [groupMember.userId],
		references: [user.id],
	}),
}));

export const groupEventTypeRelations = relations(
	groupEventType,
	({ one }) => ({
		group: one(group, {
			fields: [groupEventType.groupId],
			references: [group.id],
		}),
	}),
);

export const bookingAttendeeRelations = relations(
	bookingAttendee,
	({ one }) => ({
		booking: one(booking, {
			fields: [bookingAttendee.bookingId],
			references: [booking.id],
		}),
		user: one(user, {
			fields: [bookingAttendee.userId],
			references: [user.id],
		}),
	}),
);
