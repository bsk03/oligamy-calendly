import { google } from 'googleapis';
import { env } from '@/env';
import { CalendarResponseStatus } from '@/server/db/schema';

export function getOAuth2Client() {
	return new google.auth.OAuth2(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		env.GOOGLE_REDIRECT_URI,
	);
}

const SCOPES = [
	'https://www.googleapis.com/auth/calendar.readonly',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/userinfo.email',
];

export function getAuthUrl() {
	const client = getOAuth2Client();
	return client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
		prompt: 'consent',
	});
}

export async function getTokensFromCode(code: string) {
	const client = getOAuth2Client();
	const { tokens } = await client.getToken(code);
	return tokens;
}

/**
 * Fetches the email address of the Google account using the access token.
 */
export async function getGoogleAccountEmail(accessToken: string): Promise<string> {
	const oauth2Client = getOAuth2Client();
	oauth2Client.setCredentials({ access_token: accessToken });

	const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
	const { data } = await oauth2.userinfo.get();

	if (!data.email) {
		throw new Error('Could not retrieve Google account email');
	}

	return data.email;
}

export async function refreshAccessToken(refreshToken: string) {
	const client = getOAuth2Client();
	client.setCredentials({ refresh_token: refreshToken });
	const { credentials } = await client.refreshAccessToken();
	return credentials;
}

/**
 * Creates a Google Calendar event with an auto-generated Google Meet link.
 * Returns the event ID and Meet link, or null if calendar is not connected.
 */
export async function createCalendarEvent(opts: {
	accessToken: string;
	refreshToken: string;
	calendarId: string;
	summary: string;
	description: string;
	startTime: Date;
	endTime: Date;
	hostEmail: string;
	guestEmail: string;
	guestName: string;
	additionalAttendees?: { email: string; displayName?: string }[];
}): Promise<{ googleEventId: string; meetLink: string } | null> {
	const oauth2 = getOAuth2Client();
	oauth2.setCredentials({
		access_token: opts.accessToken,
		refresh_token: opts.refreshToken,
	});

	const calendar = google.calendar({ version: "v3", auth: oauth2 });

	const attendees = [
		{ email: opts.hostEmail, responseStatus: CalendarResponseStatus.NEEDS_ACTION },
		{ email: opts.guestEmail, displayName: opts.guestName },
		...(opts.additionalAttendees ?? []).map((a) => ({
			email: a.email,
			displayName: a.displayName,
		})),
	];

	const event = await calendar.events.insert({
		calendarId: opts.calendarId,
		conferenceDataVersion: 1,
		sendUpdates: "all",
		requestBody: {
			summary: opts.summary,
			description: opts.description,
			start: {
				dateTime: opts.startTime.toISOString(),
			},
			end: {
				dateTime: opts.endTime.toISOString(),
			},
			attendees,
			conferenceData: {
				createRequest: {
					requestId: crypto.randomUUID(),
					conferenceSolutionKey: { type: "hangoutsMeet" },
				},
			},
		},
	});

	const googleEventId = event.data.id;
	const meetLink =
		event.data.conferenceData?.entryPoints?.find(
			(ep) => ep.entryPointType === "video",
		)?.uri ?? event.data.hangoutLink;

	if (!googleEventId) return null;

	return {
		googleEventId,
		meetLink: meetLink ?? "",
	};
}

/**
 * Accepts a Google Calendar event (sets host responseStatus to "accepted").
 */
export async function acceptCalendarEvent(opts: {
	accessToken: string;
	refreshToken: string;
	calendarId: string;
	googleEventId: string;
	hostEmail: string;
}): Promise<void> {
	const oauth2 = getOAuth2Client();
	oauth2.setCredentials({
		access_token: opts.accessToken,
		refresh_token: opts.refreshToken,
	});

	const calendar = google.calendar({ version: "v3", auth: oauth2 });

	const event = await calendar.events.get({
		calendarId: opts.calendarId,
		eventId: opts.googleEventId,
	});

	const attendees = (event.data.attendees ?? []).map((a) =>
		a.email === opts.hostEmail
			? { ...a, responseStatus: CalendarResponseStatus.ACCEPTED }
			: a,
	);

	await calendar.events.patch({
		calendarId: opts.calendarId,
		eventId: opts.googleEventId,
		sendUpdates: "all",
		requestBody: { attendees },
	});
}

/**
 * Gets the host's responseStatus from a Google Calendar event.
 * Returns "needsAction" | "accepted" | "declined" | "tentative" | null
 */
export async function getCalendarEventStatus(opts: {
	accessToken: string;
	refreshToken: string;
	calendarId: string;
	googleEventId: string;
	hostEmail: string;
}): Promise<string | null> {
	const oauth2 = getOAuth2Client();
	oauth2.setCredentials({
		access_token: opts.accessToken,
		refresh_token: opts.refreshToken,
	});

	const calendar = google.calendar({ version: "v3", auth: oauth2 });

	const event = await calendar.events.get({
		calendarId: opts.calendarId,
		eventId: opts.googleEventId,
	});

	const hostAttendee = (event.data.attendees ?? []).find(
		(a) => a.email === opts.hostEmail,
	);

	return hostAttendee?.responseStatus ?? null;
}

/**
 * Lists all calendars accessible by the user.
 * Returns calendar id, summary, background color, whether it's primary, and access role.
 */
export async function listUserCalendars(opts: {
	accessToken: string;
	refreshToken: string;
}): Promise<
	{
		id: string;
		summary: string;
		backgroundColor: string;
		primary: boolean;
		accessRole: string;
	}[]
> {
	const oauth2 = getOAuth2Client();
	oauth2.setCredentials({
		access_token: opts.accessToken,
		refresh_token: opts.refreshToken,
	});

	const calendar = google.calendar({ version: "v3", auth: oauth2 });
	const res = await calendar.calendarList.list();

	return (res.data.items ?? [])
		.filter((item) => !item.deleted && item.id)
		.map((item) => ({
			id: item.id!,
			summary: item.summaryOverride ?? item.summary ?? item.id!,
			backgroundColor: item.backgroundColor ?? "#3B82F6",
			primary: item.primary ?? false,
			accessRole: item.accessRole ?? "reader",
		}));
}

/**
 * Declines a Google Calendar event (sets host responseStatus to "declined").
 */
export async function declineCalendarEvent(opts: {
	accessToken: string;
	refreshToken: string;
	calendarId: string;
	googleEventId: string;
	hostEmail: string;
}): Promise<void> {
	const oauth2 = getOAuth2Client();
	oauth2.setCredentials({
		access_token: opts.accessToken,
		refresh_token: opts.refreshToken,
	});

	const calendar = google.calendar({ version: "v3", auth: oauth2 });

	const event = await calendar.events.get({
		calendarId: opts.calendarId,
		eventId: opts.googleEventId,
	});

	const attendees = (event.data.attendees ?? []).map((a) =>
		a.email === opts.hostEmail
			? { ...a, responseStatus: CalendarResponseStatus.DECLINED }
			: a,
	);

	await calendar.events.patch({
		calendarId: opts.calendarId,
		eventId: opts.googleEventId,
		sendUpdates: "all",
		requestBody: { attendees },
	});
}
