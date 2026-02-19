import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { google } from "googleapis";

import type { db as DbType } from "@/server/db";
import {
	ACTIVE_BOOKING_STATUSES,
	availability,
	availabilityOverride,
	booking,
	eventType,
	googleCalendarToken,
	profile,
} from "@/server/db/schema";
import { getOAuth2Client } from "@/server/lib/google-calendar";

type Db = typeof DbType;

/**
 * Returns an array of date strings ("YYYY-MM-DD") that have at least one
 * available slot in the given month. Checks Google Calendar FreeBusy
 * and existing bookings (single call each for the whole month).
 */
export async function getAvailableDatesForMonth(
	db: Db,
	userId: string,
	eventTypeId: string,
	year: number,
	month: number, // 1-based (1=January)
): Promise<string[]> {
	// Fetch event type
	const [et] = await db
		.select()
		.from(eventType)
		.where(and(eq(eventType.id, eventTypeId), eq(eventType.userId, userId)))
		.limit(1);

	if (!et) {
		return [];
	}

	// Fetch profile for timezone
	const [userProfile] = await db
		.select()
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const timezone = userProfile?.timezone ?? "Europe/Warsaw";

	// Fetch weekly availability
	const weeklySlots = await db
		.select()
		.from(availability)
		.where(
			and(
				eq(availability.userId, userId),
				eq(availability.isAvailable, true),
			),
		);

	// Fetch overrides for this month
	const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

	const overrides = await db
		.select()
		.from(availabilityOverride)
		.where(
			and(
				eq(availabilityOverride.userId, userId),
				gte(availabilityOverride.date, monthStart),
				lt(availabilityOverride.date, monthEnd),
			),
		);

	const overrideMap = new Map(overrides.map((o) => [o.date, o]));
	const weeklySlotMap = new Map(weeklySlots.map((s) => [s.dayOfWeek, s]));

	const now = new Date();
	const duration = et.durationMinutes;
	const minNoticeMs = et.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	// Compute max bookable date from profile-level booking window
	let maxBookableDate: Date;
	if (userProfile?.bookingWindowMode === "absolute" && userProfile.bookingWindowEndDate) {
		maxBookableDate = parseLocalDate(userProfile.bookingWindowEndDate, timezone);
		maxBookableDate.setHours(23, 59, 59, 999);
	} else {
		const windowDays = userProfile?.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	// First pass: collect candidate dates with their work windows
	const daysInMonth = new Date(year, month, 0).getDate();
	const candidates: { dateStr: string; dayStart: Date; dayEnd: Date }[] = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const dateObj = parseLocalDate(dateStr, timezone);

		const endOfDay = new Date(dateObj);
		endOfDay.setHours(23, 59, 59, 999);
		if (endOfDay < earliestBookable) continue;
		if (dateObj > maxBookableDate) continue;

		const override = overrideMap.get(dateStr);
		let startTimeStr: string | null = null;
		let endTimeStr: string | null = null;

		if (override) {
			if (!override.isAvailable || !override.startTime || !override.endTime) continue;
			startTimeStr = override.startTime;
			endTimeStr = override.endTime;
		} else {
			const dayOfWeek = dateObj.getDay();
			const ws = weeklySlotMap.get(dayOfWeek);
			if (!ws) continue;
			startTimeStr = ws.startTime;
			endTimeStr = ws.endTime;
		}

		const [sh, sm] = startTimeStr.split(":").map(Number) as [number, number];
		const [eh, em] = endTimeStr.split(":").map(Number) as [number, number];

		const dayStart = parseLocalDate(dateStr, timezone);
		dayStart.setHours(sh, sm, 0, 0);
		const dayEnd = parseLocalDate(dateStr, timezone);
		dayEnd.setHours(eh, em, 0, 0);

		candidates.push({ dateStr, dayStart, dayEnd });
	}

	if (candidates.length === 0) return [];

	// Fetch busy periods for the entire month range in one call
	const rangeMin = candidates[0]!.dayStart;
	const rangeMax = candidates[candidates.length - 1]!.dayEnd;

	const [busyPeriods, existingBookings] = await Promise.all([
		getGoogleCalendarBusyPeriods(db, userId, rangeMin, rangeMax),
		db
			.select({ startTime: booking.startTime, endTime: booking.endTime })
			.from(booking)
			.where(
				and(
					eq(booking.hostId, userId),
					inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
					gte(booking.endTime, rangeMin),
					lt(booking.startTime, rangeMax),
				),
			),
	]);

	const allBusy = [
		...busyPeriods,
		...existingBookings.map((b) => ({ start: b.startTime, end: b.endTime })),
	];

	// Second pass: for each candidate, check if at least one slot is free
	const dates: string[] = [];

	for (const { dateStr, dayStart, dayEnd } of candidates) {
		let cursor = new Date(dayStart);
		let hasAvailableSlot = false;

		while (cursor.getTime() + duration * 60_000 <= dayEnd.getTime()) {
			const slotStart = cursor;
			const slotEnd = new Date(cursor.getTime() + duration * 60_000);

			if (slotStart >= earliestBookable && slotStart <= maxBookableDate) {
				const isBusy = allBusy.some(
					(busy) => slotStart < busy.end && slotEnd > busy.start,
				);
				if (!isBusy) {
					hasAvailableSlot = true;
					break;
				}
			}

			cursor = new Date(cursor.getTime() + duration * 60_000);
		}

		if (hasAvailableSlot) {
			dates.push(dateStr);
		}
	}

	return dates;
}

/**
 * Returns available time slots for a specific date.
 * Checks Google Calendar FreeBusy and existing bookings.
 */
export async function getAvailableSlots(
	db: Db,
	userId: string,
	eventTypeId: string,
	dateString: string, // "YYYY-MM-DD"
): Promise<{ start: string; end: string }[]> {
	// 1. Fetch event type
	const [et] = await db
		.select()
		.from(eventType)
		.where(and(eq(eventType.id, eventTypeId), eq(eventType.userId, userId)))
		.limit(1);

	if (!et) return [];

	// 2. Fetch profile for timezone
	const [userProfile] = await db
		.select()
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const timezone = userProfile?.timezone ?? "Europe/Warsaw";

	// 3. Check override for this date
	const [override] = await db
		.select()
		.from(availabilityOverride)
		.where(
			and(
				eq(availabilityOverride.userId, userId),
				eq(availabilityOverride.date, dateString),
			),
		)
		.limit(1);

	let startTime: string;
	let endTime: string;

	if (override) {
		if (!override.isAvailable) return [];
		if (!override.startTime || !override.endTime) return [];
		startTime = override.startTime;
		endTime = override.endTime;
	} else {
		// 4. Check weekly availability for this day of week
		const dateObj = parseLocalDate(dateString, timezone);
		const dayOfWeek = dateObj.getDay();

		const [weeklySlot] = await db
			.select()
			.from(availability)
			.where(
				and(
					eq(availability.userId, userId),
					eq(availability.dayOfWeek, dayOfWeek),
					eq(availability.isAvailable, true),
				),
			)
			.limit(1);

		if (!weeklySlot) return [];
		startTime = weeklySlot.startTime;
		endTime = weeklySlot.endTime;
	}

	// 5. Generate slots
	const duration = et.durationMinutes;
	const slots: { start: Date; end: Date }[] = [];

	const [startHour, startMin] = startTime.split(":").map(Number) as [
		number,
		number,
	];
	const [endHour, endMin] = endTime.split(":").map(Number) as [
		number,
		number,
	];

	const dayStart = parseLocalDate(dateString, timezone);
	dayStart.setHours(startHour, startMin, 0, 0);

	const dayEnd = parseLocalDate(dateString, timezone);
	dayEnd.setHours(endHour, endMin, 0, 0);

	let cursor = new Date(dayStart);
	while (cursor.getTime() + duration * 60 * 1000 <= dayEnd.getTime()) {
		const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);
		slots.push({ start: new Date(cursor), end: slotEnd });
		cursor = new Date(cursor.getTime() + duration * 60 * 1000);
	}

	// 6. Filter slots before now + minimumNoticeHours and after booking window end
	const now = new Date();
	const minNoticeMs = et.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	let maxBookableDate: Date;
	if (userProfile?.bookingWindowMode === "absolute" && userProfile.bookingWindowEndDate) {
		maxBookableDate = parseLocalDate(userProfile.bookingWindowEndDate, timezone);
		maxBookableDate.setHours(23, 59, 59, 999);
	} else {
		const windowDays = userProfile?.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	const filteredSlots = slots.filter(
		(s) => s.start >= earliestBookable && s.start <= maxBookableDate,
	);
	if (filteredSlots.length === 0) return [];

	// 7. Get busy periods from Google Calendar
	const timeMin = filteredSlots[0]!.start;
	const timeMax = filteredSlots[filteredSlots.length - 1]!.end;

	const busyPeriods = await getGoogleCalendarBusyPeriods(
		db,
		userId,
		timeMin,
		timeMax,
	);

	// 8. Get existing bookings
	const existingBookings = await db
		.select({ startTime: booking.startTime, endTime: booking.endTime })
		.from(booking)
		.where(
			and(
				eq(booking.hostId, userId),
				inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
				gte(booking.startTime, timeMin),
				lt(booking.startTime, timeMax),
			),
		);

	// 9. Filter out conflicting slots
	const allBusy = [
		...busyPeriods,
		...existingBookings.map((b) => ({
			start: b.startTime,
			end: b.endTime,
		})),
	];

	const availableSlots = filteredSlots.filter((slot) => {
		return !allBusy.some(
			(busy) => slot.start < busy.end && slot.end > busy.start,
		);
	});

	return availableSlots.map((s) => ({
		start: s.start.toISOString(),
		end: s.end.toISOString(),
	}));
}

/**
 * Fetches busy periods from Google Calendar FreeBusy API.
 * Auto-refreshes token if expired. Returns [] on any error (graceful degradation).
 */
export async function getGoogleCalendarBusyPeriods(
	db: Db,
	userId: string,
	timeMin: Date,
	timeMax: Date,
): Promise<{ start: Date; end: Date }[]> {
	const logPrefix = "[Google Calendar]";
	try {
		console.log(logPrefix, "Pobieranie zajętości", {
			userId,
			timeMin: timeMin.toISOString(),
			timeMax: timeMax.toISOString(),
		});

		const [token] = await db
			.select()
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, userId))
			.limit(1);

		if (!token) {
			console.log(logPrefix, "Brak tokenu dla użytkownika, pomijam kalendarz", {
				userId,
			});
			return [];
		}

		const oauth2 = getOAuth2Client();

		// Auto-refresh if expired
		if (token.expiresAt < new Date()) {
			console.log(logPrefix, "Odświeżanie wygasłego tokenu", { userId });
			oauth2.setCredentials({ refresh_token: token.refreshToken });
			const { credentials } = await oauth2.refreshAccessToken();

			if (credentials.access_token && credentials.expiry_date) {
				await db
					.update(googleCalendarToken)
					.set({
						accessToken: credentials.access_token,
						expiresAt: new Date(credentials.expiry_date),
						updatedAt: new Date(),
					})
					.where(eq(googleCalendarToken.id, token.id));

				oauth2.setCredentials({
					access_token: credentials.access_token,
					refresh_token: token.refreshToken,
				});
			}
		} else {
			oauth2.setCredentials({
				access_token: token.accessToken,
				refresh_token: token.refreshToken,
			});
		}

		const calendar = google.calendar({ version: "v3", auth: oauth2 });
		const calendarIds = token.busyCalendarIds ?? ["primary"];

		console.log(logPrefix, "Wywołanie FreeBusy API", {
			userId,
			calendarIds,
		});

		const res = await calendar.freebusy.query({
			requestBody: {
				timeMin: timeMin.toISOString(),
				timeMax: timeMax.toISOString(),
				items: calendarIds.map((id) => ({ id })),
			},
		});

		const busyPeriods: { start: Date; end: Date }[] = [];
		const calendars = res.data.calendars;
		if (calendars) {
			for (const calId of calendarIds) {
				const cal = calendars[calId];
				if (cal?.busy) {
					for (const period of cal.busy) {
						if (period.start && period.end) {
							busyPeriods.push({
								start: new Date(period.start),
								end: new Date(period.end),
							});
						}
					}
				}
			}
		}

		console.log(logPrefix, "Pobrano zajętość z Google Calendar", {
			userId,
			calendarIds,
			busyPeriodsCount: busyPeriods.length,
		});

		return busyPeriods;
	} catch (err) {
		console.error(logPrefix, "Błąd FreeBusy:", { userId, err });
		return [];
	}
}

/**
 * Parses a "YYYY-MM-DD" string into a Date at midnight in the given timezone.
 * Simple approach: we create a date from the string parts which gives us local midnight.
 */
function parseLocalDate(dateStr: string, _timezone: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number) as [
		number,
		number,
		number,
	];
	return new Date(year, month - 1, day);
}
