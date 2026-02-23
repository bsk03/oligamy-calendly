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
 * Intersects two sets of time ranges (using "HH:MM" string comparison).
 * Returns the overlapping portions, or empty array if no overlap.
 */
function intersectRangeSets(
	setA: TimeRange[],
	setB: TimeRange[],
): TimeRange[] {
	const result: TimeRange[] = [];
	for (const a of setA) {
		for (const b of setB) {
			const start = a.startTime > b.startTime ? a.startTime : b.startTime;
			const end = a.endTime < b.endTime ? a.endTime : b.endTime;
			if (start < end) {
				result.push({ startTime: start, endTime: end });
			}
		}
	}
	return result;
}

/**
 * Given weekly availability for multiple users, returns the intersection
 * of all their schedules for each day of the week (0-6).
 * If ANY user has no availability on a given day, that day has no ranges.
 */
function intersectWeeklySchedules(
	allUsersSlots: Map<number, TimeRange[]>[],
): Map<number, TimeRange[]> {
	if (allUsersSlots.length === 0) return new Map();
	if (allUsersSlots.length === 1) return allUsersSlots[0]!;

	const result = new Map<number, TimeRange[]>();

	for (let day = 0; day <= 6; day++) {
		let current: TimeRange[] | null = null;

		for (const userSlots of allUsersSlots) {
			const dayRanges = userSlots.get(day);
			if (!dayRanges || dayRanges.length === 0) {
				// This user has no availability on this day — intersection is empty
				current = null;
				break;
			}

			if (current === null) {
				current = dayRanges;
			} else {
				current = intersectRangeSets(current, dayRanges);
				if (current.length === 0) {
					current = null;
					break;
				}
			}
		}

		if (current && current.length > 0) {
			result.set(day, current);
		}
	}

	return result;
}

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
		const dayStart = localToUTC(dateStr, range.startTime, timezone);
		const dayEnd = localToUTC(dateStr, range.endTime, timezone);

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
		maxBookableDate = endOfDayUTC(userProfile.bookingWindowEndDate, timezone);
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

		const eod = endOfDayUTC(dateStr, timezone);
		if (eod < earliestBookable) continue;
		const dayMidnight = localToUTC(dateStr, '00:00', timezone);
		if (dayMidnight > maxBookableDate) continue;

		const dayOfWeek = dayOfWeekFromDateStr(dateStr);
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
	const dayOfWeek = dayOfWeekFromDateStr(dateString);

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
		const dayStart = localToUTC(dateString, range.startTime, timezone);
		const dayEnd = localToUTC(dateString, range.endTime, timezone);

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
		maxBookableDate = endOfDayUTC(userProfile.bookingWindowEndDate, timezone);
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

	const { allUserIds, eventConfig } = info;
	console.log(LOG, 'Group info', {
		allUserIds,
		durationMinutes: eventConfig.durationMinutes,
		minimumNoticeHours: eventConfig.minimumNoticeHours,
	});

	// Group-level timezone + booking window
	const timezone = info.group.timezone ?? 'Europe/Warsaw';
	console.log(LOG, 'Group settings', {
		timezone,
		bookingWindowMode: info.group.bookingWindowMode,
		bookingWindowDays: info.group.bookingWindowDays,
		bookingWindowEndDate: info.group.bookingWindowEndDate,
	});

	// Fetch weekly availability for ALL members, then intersect
	const allMemberSlots = await Promise.all(
		allUserIds.map(async (uid) => {
			const slots = await db
				.select()
				.from(availability)
				.where(
					and(eq(availability.userId, uid), eq(availability.isAvailable, true)),
				);
			const slotMap = new Map<number, TimeRange[]>();
			for (const s of slots) {
				const existing = slotMap.get(s.dayOfWeek);
				const range = { startTime: s.startTime, endTime: s.endTime };
				if (existing) {
					existing.push(range);
				} else {
					slotMap.set(s.dayOfWeek, [range]);
				}
			}
			return slotMap;
		}),
	);

	const weeklySlotMap = intersectWeeklySchedules(allMemberSlots);

	console.log(LOG, 'Intersected weekly slots', Array.from(weeklySlotMap.entries()).map(([day, ranges]) =>
		`day${day}: ${ranges.map((r) => `${r.startTime}-${r.endTime}`).join(', ')}`,
	));

	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

	const now = new Date();
	const duration = eventConfig.durationMinutes;
	const minNoticeMs = eventConfig.minimumNoticeHours * 60 * 60 * 1000;
	const earliestBookable = new Date(now.getTime() + minNoticeMs);

	let maxBookableDate: Date;
	if (
		info.group.bookingWindowMode === 'absolute' &&
		info.group.bookingWindowEndDate
	) {
		maxBookableDate = endOfDayUTC(info.group.bookingWindowEndDate, timezone);
	} else {
		const windowDays = info.group.bookingWindowDays ?? 30;
		maxBookableDate = new Date();
		maxBookableDate.setDate(maxBookableDate.getDate() + windowDays);
	}

	console.log(LOG, 'Booking window', {
		now: now.toISOString(),
		earliestBookable: earliestBookable.toISOString(),
		maxBookableDate: maxBookableDate.toISOString(),
	});

	// Collect candidate dates from intersected work windows
	const daysInMonth = new Date(year, month, 0).getDate();
	const candidates: { dateStr: string; windows: { dayStart: Date; dayEnd: Date }[] }[] = [];
	const skippedDates: { dateStr: string; reason: string }[] = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const eod = endOfDayUTC(dateStr, timezone);
		if (eod < earliestBookable) {
			skippedDates.push({ dateStr, reason: 'before earliestBookable' });
			continue;
		}
		const dayMidnight = localToUTC(dateStr, '00:00', timezone);
		if (dayMidnight > maxBookableDate) {
			skippedDates.push({ dateStr, reason: 'after maxBookableDate' });
			continue;
		}

		const dayOfWeek = dayOfWeekFromDateStr(dateStr);
		const ranges = weeklySlotMap.get(dayOfWeek);
		if (!ranges || ranges.length === 0) {
			skippedDates.push({ dateStr, reason: `no intersected work windows for dayOfWeek=${dayOfWeek}` });
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

	const { allUserIds, eventConfig } = info;
	console.log(LOG, 'Group info', { allUserIds, eventConfig });

	// Group-level timezone
	const timezone = info.group.timezone ?? 'Europe/Warsaw';

	// Determine work windows from intersection of ALL members' schedules
	const dayOfWeek = dayOfWeekFromDateStr(dateString);
	console.log(LOG, 'Date info', { dateString, dayOfWeek, timezone });

	// Fetch weekly availability for all members and intersect
	const allMemberSlots = await Promise.all(
		allUserIds.map(async (uid) => {
			const slots = await db
				.select()
				.from(availability)
				.where(
					and(
						eq(availability.userId, uid),
						eq(availability.dayOfWeek, dayOfWeek),
						eq(availability.isAvailable, true),
					),
				);
			const ranges: TimeRange[] = slots.map((s) => ({
				startTime: s.startTime,
				endTime: s.endTime,
			}));
			return ranges;
		}),
	);

	// Intersect all members' ranges for this day
	let workRanges: TimeRange[] | null = null;
	for (const memberRanges of allMemberSlots) {
		if (memberRanges.length === 0) {
			workRanges = null;
			break;
		}
		if (workRanges === null) {
			workRanges = memberRanges;
		} else {
			workRanges = intersectRangeSets(workRanges, memberRanges);
			if (workRanges.length === 0) {
				workRanges = null;
				break;
			}
		}
	}

	if (!workRanges || workRanges.length === 0) {
		console.log(LOG, 'No intersected work ranges for this day');
		return [];
	}

	console.log(LOG, 'Intersected work ranges', workRanges);

	// Generate slots from all work ranges
	const duration = eventConfig.durationMinutes;
	const slots: { start: Date; end: Date }[] = [];

	for (const range of workRanges) {
		const dayStart = localToUTC(dateString, range.startTime, timezone);
		const dayEnd = localToUTC(dateString, range.endTime, timezone);

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
		info.group.bookingWindowMode === 'absolute' &&
		info.group.bookingWindowEndDate
	) {
		maxBookableDate = endOfDayUTC(info.group.bookingWindowEndDate, timezone);
	} else {
		const windowDays = info.group.bookingWindowDays ?? 30;
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
 * Returns the UTC offset in milliseconds for a given timezone at a given UTC moment.
 * Positive means the timezone is ahead of UTC (e.g., +7200000 for UTC+2).
 */
function getTimezoneOffsetMs(utcDate: Date, timezone: string): number {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hour12: false,
	});
	const parts = formatter.formatToParts(utcDate);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parseInt(parts.find((p) => p.type === type)!.value);

	let hour = get('hour');
	if (hour === 24) hour = 0;

	const localAsUtcMs = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		hour,
		get('minute'),
		get('second'),
	);

	return localAsUtcMs - utcDate.getTime();
}

/**
 * Converts a local date + time in a timezone to a UTC Date object.
 * E.g., localToUTC("2024-03-15", "09:00", "Europe/Warsaw") returns a Date
 * representing 2024-03-15 09:00 Warsaw time expressed in UTC.
 */
function localToUTC(dateStr: string, timeStr: string, timezone: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
	const [hour, minute] = timeStr.split(':').map(Number) as [number, number];

	const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

	const offset1 = getTimezoneOffsetMs(new Date(localAsUtcMs), timezone);
	const adjusted = localAsUtcMs - offset1;

	// Verify offset didn't change due to DST transition at boundary
	const offset2 = getTimezoneOffsetMs(new Date(adjusted), timezone);
	if (offset1 !== offset2) {
		return new Date(localAsUtcMs - offset2);
	}

	return new Date(adjusted);
}

/**
 * Returns a UTC Date for end of day (23:59:59.999) in the given timezone.
 */
function endOfDayUTC(dateStr: string, timezone: string): Date {
	const eod = localToUTC(dateStr, '23:59', timezone);
	return new Date(eod.getTime() + 59 * 1000 + 999);
}

/**
 * Computes day of week from a "YYYY-MM-DD" string using UTC to avoid timezone issues.
 * Returns 0 (Sunday) through 6 (Saturday).
 */
function dayOfWeekFromDateStr(dateStr: string): number {
	const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number];
	return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
