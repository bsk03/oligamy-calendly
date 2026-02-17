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
		username: d.text().notNull().unique(),
		bio: d.text(),
		avatarUrl: d.text(),
		timezone: d.text().notNull().default("Europe/Warsaw"),
		isVisibleOnHome: d.boolean().notNull().default(true),
		createdAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.$defaultFn(() => new Date())
			.notNull(),
	}),
	(t) => [uniqueIndex("profile_username_idx").on(t.username)],
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
		uniqueIndex("availability_override_user_date_idx").on(t.userId, t.date),
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
			.notNull()
			.references(() => eventType.id),
		guestName: d.text().notNull(),
		guestEmail: d.text().notNull(),
		guestPhone: d.text(),
		guestNotes: d.text(),
		startTime: d.timestamp({ withTimezone: true }).notNull(),
		endTime: d.timestamp({ withTimezone: true }).notNull(),
		timezone: d.text().notNull(),
		status: d.text().notNull().default("PENDING"), // PENDING | CONFIRMED | CANCELLED | COMPLETED
		googleEventId: d.text(),
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
			.unique()
			.references(() => user.id, { onDelete: "cascade" }),
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
	googleCalendarToken: one(googleCalendarToken),
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

export const bookingRelations = relations(booking, ({ one }) => ({
	host: one(user, { fields: [booking.hostId], references: [user.id] }),
	eventType: one(eventType, {
		fields: [booking.eventTypeId],
		references: [eventType.id],
	}),
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
