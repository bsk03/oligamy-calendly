import { and, eq, gte, lt, inArray, or } from 'drizzle-orm';
import { google } from 'googleapis';

import type { db as DbType } from '@/server/db';
import {
	ACTIVE_BOOKING_STATUSES,
	availability,
	availabilityOverride,
	booking,
	bookingAttendee,
	eventType,
	group,
	groupEventType,
	groupMember,
	profile,
} from '@/server/db/schema';
import { getOAuth2Client } from '@/server/lib/google-calendar';
import { getAllUserTokens } from '@/server/lib/google-calendar-token';

type Db = typeof DbType;

type TimeRange = { startTime: string; endTime: string };

type OverrideRow = {
	date: string;
	isAvailable: boolean;
	startTime: string | null;
	endTime: string | null;
};

type AvailSlot = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	isAvailable: boolean;
};

/**
 * Collects work windows for a specific day, checking overrides first then weekly schedule.
 * Returns null if day is unavailable, or an array of {startTime, endTime} ranges.
 */
function getWorkWindows(
	overrideMap: Map<string, OverrideRow[]>,
	weeklySlotMap: Map<number, AvailSlot[]>,
	dateStr: string,
	dayOfWeek: number,
): TimeRange[] | null {
	const overrides = overrideMap.get(dateStr);
	if (overrides && overrides.length > 0) {
		// If any override is unavailable, the whole day is off
		if (overrides.some((o) => !o.isAvailable)) return null;
		const ranges: TimeRange[] = [];
		for (const o of overrides) {
			if (o.startTime && o.endTime) {
				ranges.push({ startTime: o.startTime, endTime: o.endTime });
			}
		}
		return ranges.length > 0 ? ranges : null;
	}

	const weeklySlots = weeklySlotMap.get(dayOfWeek);
	if (!weeklySlots || weeklySlots.length === 0) return null;
	return weeklySlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
}

/**
 * Groups an array by a key function into a Map of arrays.
 */
function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
	const map = new Map<K, T[]>();
	for (const item of arr) {
		const key = keyFn(item);
		const existing = map.get(key);
		if (existing) {
			existing.push(item);
		} else {
			map.set(key, [item]);
		}
	}
	return map;
}

/**
 * Generates time slot candidates for multiple work windows on a single day.
 */
function generateCandidatesForDay(
	dateStr: string,
	ranges: TimeRange[],
	timezone: string,
): { dayStart: Date; dayEnd: Date }[] {
	const candidates: { dayStart: Date; dayEnd: Date }[] = [];
	for (const range of ranges) {
		const [sh, sm] = range.startTime.split(':').map(Number) as [number, number];
		const [eh, em] = range.endTime.split(':').map(Number) as [number, number];

		const dayStart = parseLocalDate(dateStr, timezone);
		dayStart.setHours(sh, sm, 0, 0);
		const dayEnd = parseLocalDate(dateStr, timezone);
		dayEnd.setHours(eh, em, 0, 0);

		candidates.push({ dayStart, dayEnd });
	}
	return candidates;
}

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

	const timezone = userProfile?.timezone ?? 'Europe/Warsaw';

	// Fetch weekly availability
	const weeklySlots = await db
		.select()
		.from(availability)
		.where(
			and(eq(availability.userId, userId), eq(availability.isAvailable, true)),
		);

	// Fetch overrides for this month
	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

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

	const overrideMap = groupBy(overrides, (o) => o.date);
	const weeklySlotMap = groupBy(weeklySlots, (s) => s.dayOfWeek);

	const now = new Date();
	const duration = et.durationMinutes;
	const minNoticeMs = et.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	// Compute max bookable date from profile-level booking window
	let maxBookableDate: Date;
	if (
		userProfile?.bookingWindowMode === 'absolute' &&
		userProfile.bookingWindowEndDate
	) {
		maxBookableDate = parseLocalDate(
			userProfile.bookingWindowEndDate,
			timezone,
		);
		maxBookableDate.setHours(23, 59, 59, 999);
	} else {
		const windowDays = userProfile?.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	// First pass: collect candidate dates with their work windows
	const daysInMonth = new Date(year, month, 0).getDate();
	const candidates: { dateStr: string; windows: { dayStart: Date; dayEnd: Date }[] }[] = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const dateObj = parseLocalDate(dateStr, timezone);

		const endOfDay = new Date(dateObj);
		endOfDay.setHours(23, 59, 59, 999);
		if (endOfDay < earliestBookable) continue;
		if (dateObj > maxBookableDate) continue;

		const dayOfWeek = dateObj.getDay();
		const ranges = getWorkWindows(overrideMap, weeklySlotMap, dateStr, dayOfWeek);
		if (!ranges) continue;

		const windows = generateCandidatesForDay(dateStr, ranges, timezone);
		if (windows.length > 0) {
			candidates.push({ dateStr, windows });
		}
	}

	if (candidates.length === 0) return [];

	// Fetch busy periods for the entire month range in one call
	const rangeMin = candidates[0]!.windows[0]!.dayStart;
	const rangeMax = candidates[candidates.length - 1]!.windows[candidates[candidates.length - 1]!.windows.length - 1]!.dayEnd;

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

	for (const { dateStr, windows } of candidates) {
		let hasAvailableSlot = false;

		for (const { dayStart, dayEnd } of windows) {
			let cursor = new Date(dayStart);

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

			if (hasAvailableSlot) break;
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

	const timezone = userProfile?.timezone ?? 'Europe/Warsaw';

	// 3. Determine work windows for this date
	const dateObj = parseLocalDate(dateString, timezone);
	const dayOfWeek = dateObj.getDay();

	// Check overrides for this date
	const overridesForDate = await db
		.select()
		.from(availabilityOverride)
		.where(
			and(
				eq(availabilityOverride.userId, userId),
				eq(availabilityOverride.date, dateString),
			),
		);

	let workRanges: TimeRange[];

	if (overridesForDate.length > 0) {
		// If any override is unavailable, no slots
		if (overridesForDate.some((o) => !o.isAvailable)) return [];
		workRanges = overridesForDate
			.filter((o) => o.startTime && o.endTime)
			.map((o) => ({ startTime: o.startTime!, endTime: o.endTime! }));
		if (workRanges.length === 0) return [];
	} else {
		// 4. Check weekly availability for this day of week
		const weeklySlots = await db
			.select()
			.from(availability)
			.where(
				and(
					eq(availability.userId, userId),
					eq(availability.dayOfWeek, dayOfWeek),
					eq(availability.isAvailable, true),
				),
			);

		if (weeklySlots.length === 0) return [];
		workRanges = weeklySlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
	}

	// 5. Generate slots from all work ranges
	const duration = et.durationMinutes;
	const slots: { start: Date; end: Date }[] = [];

	for (const range of workRanges) {
		const [startHour, startMin] = range.startTime.split(':').map(Number) as [number, number];
		const [endHour, endMin] = range.endTime.split(':').map(Number) as [number, number];

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
	}

	// 6. Filter slots before now + minimumNoticeHours and after booking window end
	const now = new Date();
	const minNoticeMs = et.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	let maxBookableDate: Date;
	if (
		userProfile?.bookingWindowMode === 'absolute' &&
		userProfile.bookingWindowEndDate
	) {
		maxBookableDate = parseLocalDate(
			userProfile.bookingWindowEndDate,
			timezone,
		);
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
	const logPrefix = '[Google Calendar]';
	try {
		console.log(logPrefix, 'Pobieranie zajętości', {
			userId,
			timeMin: timeMin.toISOString(),
			timeMax: timeMax.toISOString(),
		});

		const tokens = await getAllUserTokens(db, userId);

		if (tokens.length === 0) {
			console.log(logPrefix, 'Brak tokenów dla użytkownika, pomijam kalendarz', {
				userId,
			});
			return [];
		}

		const allBusyPeriods: { start: Date; end: Date }[] = [];

		for (const token of tokens) {
			try {
				const oauth2 = getOAuth2Client();
				oauth2.setCredentials({
					access_token: token.accessToken,
					refresh_token: token.refreshToken,
				});

				const calendar = google.calendar({ version: 'v3', auth: oauth2 });
				const calendarIds = token.busyCalendarIds;

				console.log(logPrefix, 'Wywołanie FreeBusy API', {
					userId,
					accountEmail: token.accountEmail,
					calendarIds,
				});

				const res = await calendar.freebusy.query({
					requestBody: {
						timeMin: timeMin.toISOString(),
						timeMax: timeMax.toISOString(),
						items: calendarIds.map((id) => ({ id })),
					},
				});

				const calendars = res.data.calendars;
				if (calendars) {
					for (const calId of calendarIds) {
						const cal = calendars[calId];

						if (cal?.errors && cal.errors.length > 0) {
							console.warn(logPrefix, `Calendar "${calId}" (${token.accountEmail}) returned errors, skipping:`, cal.errors);
							continue;
						}

						if (cal?.busy) {
							for (const period of cal.busy) {
								if (period.start && period.end) {
									allBusyPeriods.push({
										start: new Date(period.start),
										end: new Date(period.end),
									});
								}
							}
						}
					}
				}
			} catch (err) {
				// Graceful degradation: skip this account, continue with others
				console.error(logPrefix, `Błąd FreeBusy dla konta ${token.accountEmail}:`, { userId, err });
			}
		}

		console.log(logPrefix, 'Podsumowanie FreeBusy', {
			userId,
			accountCount: tokens.length,
			busyPeriodsCount: allBusyPeriods.length,
		});

		return allBusyPeriods;
	} catch (err) {
		console.error(logPrefix, 'Błąd FreeBusy:', { userId, err });
		return [];
	}
}

// ─── Group Availability ──────────────────────────────────────────

/**
 * Gets all busy periods for a single user (Google Calendar + existing bookings).
 * Includes bookings where user is host AND bookings where user is an attendee.
 */
async function getUserBusyPeriods(
	db: Db,
	userId: string,
	timeMin: Date,
	timeMax: Date,
): Promise<{ start: Date; end: Date }[]> {
	const timeFilter = and(
		inArray(booking.status, [...ACTIVE_BOOKING_STATUSES]),
		gte(booking.endTime, timeMin),
		lt(booking.startTime, timeMax),
	);

	const [gcalBusy, hostBookings, attendeeBookings] = await Promise.all([
		getGoogleCalendarBusyPeriods(db, userId, timeMin, timeMax),
		// Bookings where user is host
		db
			.select({ startTime: booking.startTime, endTime: booking.endTime })
			.from(booking)
			.where(and(eq(booking.hostId, userId), timeFilter)),
		// Bookings where user is an attendee (group bookings)
		db
			.select({ startTime: booking.startTime, endTime: booking.endTime })
			.from(bookingAttendee)
			.innerJoin(booking, eq(bookingAttendee.bookingId, booking.id))
			.where(and(eq(bookingAttendee.userId, userId), timeFilter)),
	]);

	// Deduplicate by combining all periods
	const allBookings = [...hostBookings, ...attendeeBookings];
	// Simple dedup by start+end time
	const seen = new Set<string>();
	const uniqueBookings = allBookings.filter((b) => {
		const key = `${b.startTime.getTime()}-${b.endTime.getTime()}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return [
		...gcalBusy,
		...uniqueBookings.map((b) => ({ start: b.startTime, end: b.endTime })),
	];
}

/**
 * Resolves group info from a groupEventTypeId. Returns host, members, and event config.
 */
async function resolveGroupInfo(db: Db, groupEventTypeId: string) {
	const [get] = await db
		.select()
		.from(groupEventType)
		.where(
			and(
				eq(groupEventType.id, groupEventTypeId),
				eq(groupEventType.isActive, true),
			),
		)
		.limit(1);

	if (!get) return null;

	const [g] = await db
		.select()
		.from(group)
		.where(and(eq(group.id, get.groupId), eq(group.isActive, true)))
		.limit(1);

	if (!g) return null;

	const members = await db
		.select({ userId: groupMember.userId })
		.from(groupMember)
		.where(eq(groupMember.groupId, g.id));

	// All participant userIds: host + all members (deduplicated)
	const allUserIds = [...new Set([g.hostUserId, ...members.map((m) => m.userId)])];

	return {
		group: g,
		groupEventType: get,
		hostUserId: g.hostUserId,
		allUserIds,
		eventConfig: {
			durationMinutes: get.durationMinutes,
			minimumNoticeHours: get.minimumNoticeHours,
		},
	};
}

/**
 * Returns available dates for a group — intersection of all members' availability.
 * Work window comes from the host's availability schedule.
 * Busy periods are collected from ALL members.
 */
export async function getGroupAvailableDatesForMonth(
	db: Db,
	groupEventTypeId: string,
	year: number,
	month: number,
): Promise<string[]> {
	const LOG = '[GroupDates]';
	console.log(LOG, 'START', { groupEventTypeId, year, month });

	const info = await resolveGroupInfo(db, groupEventTypeId);
	if (!info) {
		console.log(LOG, 'resolveGroupInfo returned null — group/eventType not found or inactive');
		return [];
	}

	const { hostUserId, allUserIds, eventConfig } = info;
	console.log(LOG, 'Group info', {
		hostUserId,
		allUserIds,
		durationMinutes: eventConfig.durationMinutes,
		minimumNoticeHours: eventConfig.minimumNoticeHours,
	});

	// Host profile for timezone + booking window
	const [hostProfile] = await db
		.select()
		.from(profile)
		.where(eq(profile.userId, hostUserId))
		.limit(1);

	const timezone = hostProfile?.timezone ?? 'Europe/Warsaw';
	console.log(LOG, 'Host profile', {
		hasProfile: !!hostProfile,
		timezone,
		bookingWindowMode: hostProfile?.bookingWindowMode,
		bookingWindowDays: hostProfile?.bookingWindowDays,
		bookingWindowEndDate: hostProfile?.bookingWindowEndDate,
	});

	// Host weekly availability (work window)
	const weeklySlots = await db
		.select()
		.from(availability)
		.where(
			and(eq(availability.userId, hostUserId), eq(availability.isAvailable, true)),
		);

	console.log(LOG, 'Host weekly slots', weeklySlots.map((s) => `day${s.dayOfWeek}: ${s.startTime}-${s.endTime}`));

	// Host overrides for this month
	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

	const overrides = await db
		.select()
		.from(availabilityOverride)
		.where(
			and(
				eq(availabilityOverride.userId, hostUserId),
				gte(availabilityOverride.date, monthStart),
				lt(availabilityOverride.date, monthEnd),
			),
		);

	console.log(LOG, 'Host overrides for month', overrides.length);

	const overrideMap = groupBy(overrides, (o) => o.date);
	const weeklySlotMap = groupBy(weeklySlots, (s) => s.dayOfWeek);

	const now = new Date();
	const duration = eventConfig.durationMinutes;
	const minNoticeMs = eventConfig.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	let maxBookableDate: Date;
	if (
		hostProfile?.bookingWindowMode === 'absolute' &&
		hostProfile.bookingWindowEndDate
	) {
		maxBookableDate = parseLocalDate(hostProfile.bookingWindowEndDate, timezone);
		maxBookableDate.setHours(23, 59, 59, 999);
	} else {
		const windowDays = hostProfile?.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	console.log(LOG, 'Booking window', {
		now: now.toISOString(),
		earliestBookable: earliestBookable.toISOString(),
		maxBookableDate: maxBookableDate.toISOString(),
	});

	// Collect candidate dates from host's work windows
	const daysInMonth = new Date(year, month, 0).getDate();
	const candidates: { dateStr: string; windows: { dayStart: Date; dayEnd: Date }[] }[] = [];
	const skippedDates: { dateStr: string; reason: string }[] = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const dateObj = parseLocalDate(dateStr, timezone);

		const endOfDay = new Date(dateObj);
		endOfDay.setHours(23, 59, 59, 999);
		if (endOfDay < earliestBookable) {
			skippedDates.push({ dateStr, reason: 'before earliestBookable' });
			continue;
		}
		if (dateObj > maxBookableDate) {
			skippedDates.push({ dateStr, reason: 'after maxBookableDate' });
			continue;
		}

		const dayOfWeek = dateObj.getDay();
		const ranges = getWorkWindows(overrideMap, weeklySlotMap, dateStr, dayOfWeek);
		if (!ranges) {
			skippedDates.push({ dateStr, reason: `no work windows for dayOfWeek=${dayOfWeek}` });
			continue;
		}

		const windows = generateCandidatesForDay(dateStr, ranges, timezone);
		if (windows.length > 0) {
			candidates.push({ dateStr, windows });
		} else {
			skippedDates.push({ dateStr, reason: 'generateCandidatesForDay returned empty' });
		}
	}

	console.log(LOG, 'Candidate dates', candidates.length, 'Skipped', skippedDates.length);
	if (skippedDates.length > 0) {
		console.log(LOG, 'Skipped dates (first 10):', skippedDates.slice(0, 10));
	}

	if (candidates.length === 0) return [];

	// Fetch busy periods for ALL members for the month range
	const rangeMin = candidates[0]!.windows[0]!.dayStart;
	const rangeMax = candidates[candidates.length - 1]!.windows[candidates[candidates.length - 1]!.windows.length - 1]!.dayEnd;

	console.log(LOG, 'Fetching busy periods for all users', {
		allUserIds,
		rangeMin: rangeMin.toISOString(),
		rangeMax: rangeMax.toISOString(),
	});

	const allBusyArrays = await Promise.all(
		allUserIds.map(async (uid) => {
			const busy = await getUserBusyPeriods(db, uid, rangeMin, rangeMax);
			console.log(LOG, `User ${uid} busy periods:`, busy.length, busy.slice(0, 5).map((b) => `${b.start.toISOString()} - ${b.end.toISOString()}`));
			return busy;
		}),
	);
	const allBusy = allBusyArrays.flat();
	console.log(LOG, 'Total busy periods (all members combined):', allBusy.length);

	// Check each candidate for at least one free slot
	const dates: string[] = [];

	for (const { dateStr, windows } of candidates) {
		let hasAvailableSlot = false;

		for (const { dayStart, dayEnd } of windows) {
			let cursor = new Date(dayStart);

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

			if (hasAvailableSlot) break;
		}

		if (hasAvailableSlot) {
			dates.push(dateStr);
		}
	}

	console.log(LOG, 'RESULT — available dates:', dates.length, dates.slice(0, 10));
	return dates;
}

/**
 * Returns available time slots for a group on a specific date.
 * Intersection of all members' free time.
 */
export async function getGroupAvailableSlots(
	db: Db,
	groupEventTypeId: string,
	dateString: string,
): Promise<{ start: string; end: string }[]> {
	const LOG = '[GroupSlots]';
	console.log(LOG, 'START', { groupEventTypeId, dateString });

	const info = await resolveGroupInfo(db, groupEventTypeId);
	if (!info) {
		console.log(LOG, 'resolveGroupInfo returned null');
		return [];
	}

	const { hostUserId, allUserIds, eventConfig } = info;
	console.log(LOG, 'Group info', { hostUserId, allUserIds, eventConfig });

	// Host profile
	const [hostProfile] = await db
		.select()
		.from(profile)
		.where(eq(profile.userId, hostUserId))
		.limit(1);

	const timezone = hostProfile?.timezone ?? 'Europe/Warsaw';

	// Determine work windows for this date from host's schedule
	const dateObj = parseLocalDate(dateString, timezone);
	const dayOfWeek = dateObj.getDay();
	console.log(LOG, 'Date info', { dateString, dayOfWeek, timezone });

	// Check overrides for this date (host)
	const overridesForDate = await db
		.select()
		.from(availabilityOverride)
		.where(
			and(
				eq(availabilityOverride.userId, hostUserId),
				eq(availabilityOverride.date, dateString),
			),
		);

	let workRanges: TimeRange[];

	if (overridesForDate.length > 0) {
		console.log(LOG, 'Override found for date', overridesForDate);
		if (overridesForDate.some((o) => !o.isAvailable)) {
			console.log(LOG, 'Override marks day as unavailable');
			return [];
		}
		workRanges = overridesForDate
			.filter((o) => o.startTime && o.endTime)
			.map((o) => ({ startTime: o.startTime!, endTime: o.endTime! }));
		if (workRanges.length === 0) {
			console.log(LOG, 'Override has no time ranges');
			return [];
		}
	} else {
		const weeklySlots = await db
			.select()
			.from(availability)
			.where(
				and(
					eq(availability.userId, hostUserId),
					eq(availability.dayOfWeek, dayOfWeek),
					eq(availability.isAvailable, true),
				),
			);

		console.log(LOG, `Weekly slots for dayOfWeek=${dayOfWeek}:`, weeklySlots.map((s) => `${s.startTime}-${s.endTime}`));
		if (weeklySlots.length === 0) {
			console.log(LOG, 'No weekly slots for this day');
			return [];
		}
		workRanges = weeklySlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
	}

	console.log(LOG, 'Work ranges', workRanges);

	// Generate slots from all work ranges
	const duration = eventConfig.durationMinutes;
	const slots: { start: Date; end: Date }[] = [];

	for (const range of workRanges) {
		const [startHour, startMin] = range.startTime.split(':').map(Number) as [number, number];
		const [endHour, endMin] = range.endTime.split(':').map(Number) as [number, number];

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
	}

	console.log(LOG, 'Generated raw slots:', slots.length);

	// Filter by minimum notice + booking window
	const now = new Date();
	const minNoticeMs = eventConfig.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	let maxBookableDate: Date;
	if (
		hostProfile?.bookingWindowMode === 'absolute' &&
		hostProfile.bookingWindowEndDate
	) {
		maxBookableDate = parseLocalDate(hostProfile.bookingWindowEndDate, timezone);
		maxBookableDate.setHours(23, 59, 59, 999);
	} else {
		const windowDays = hostProfile?.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	console.log(LOG, 'Filtering', {
		now: now.toISOString(),
		earliestBookable: earliestBookable.toISOString(),
		maxBookableDate: maxBookableDate.toISOString(),
	});

	const filteredSlots = slots.filter(
		(s) => s.start >= earliestBookable && s.start <= maxBookableDate,
	);
	console.log(LOG, 'After time filter:', filteredSlots.length, '(from', slots.length, ')');
	if (filteredSlots.length === 0) return [];

	// Get busy periods from ALL members
	const timeMin = filteredSlots[0]!.start;
	const timeMax = filteredSlots[filteredSlots.length - 1]!.end;

	const allBusyArrays = await Promise.all(
		allUserIds.map(async (uid) => {
			const busy = await getUserBusyPeriods(db, uid, timeMin, timeMax);
			console.log(LOG, `User ${uid} busy:`, busy.length, busy.map((b) => `${b.start.toISOString()} - ${b.end.toISOString()}`));
			return busy;
		}),
	);
	const allBusy = allBusyArrays.flat();
	console.log(LOG, 'Total busy periods:', allBusy.length);

	// Filter out slots that conflict with any member's busy time
	const availableSlots = filteredSlots.filter((slot) => {
		return !allBusy.some(
			(busy) => slot.start < busy.end && slot.end > busy.start,
		);
	});

	console.log(LOG, 'RESULT — available slots:', availableSlots.length, '(from', filteredSlots.length, 'filtered)');

	return availableSlots.map((s) => ({
		start: s.start.toISOString(),
		end: s.end.toISOString(),
	}));
}

/**
 * Parses a "YYYY-MM-DD" string into a Date at midnight in the given timezone.
 * Simple approach: we create a date from the string parts which gives us local midnight.
 */
function parseLocalDate(dateStr: string, _timezone: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number) as [
		number,
		number,
		number,
	];
	return new Date(year, month - 1, day);
}
