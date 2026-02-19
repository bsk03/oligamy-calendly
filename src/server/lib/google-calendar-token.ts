import { and, eq, inArray } from "drizzle-orm";

import type { db as DbType } from "@/server/db";
import { googleCalendarToken } from "@/server/db/schema";
import { refreshAccessToken } from "@/server/lib/google-calendar";
import { decrypt, encrypt, isEncrypted } from "@/server/lib/encryption";

type Db = typeof DbType;

export type ValidToken = {
	id: string;
	accessToken: string; // decrypted
	refreshToken: string; // decrypted
	calendarId: string;
	busyCalendarIds: string[];
	accountEmail: string;
};

/**
 * Decrypts a token value, handling on-read migration for plaintext tokens.
 * If the value is plaintext, returns it as-is (caller should re-encrypt and save).
 */
function decryptToken(value: string): { decrypted: string; wasPlaintext: boolean } {
	if (isEncrypted(value)) {
		return { decrypted: decrypt(value), wasPlaintext: false };
	}
	return { decrypted: value, wasPlaintext: true };
}

/**
 * Refreshes and saves an expired token, or encrypts plaintext tokens on read.
 * Returns the decrypted access token value.
 */
async function refreshAndSave(
	db: Db,
	token: typeof googleCalendarToken.$inferSelect,
	access: { decrypted: string; wasPlaintext: boolean },
	refresh: { decrypted: string; wasPlaintext: boolean },
): Promise<string | null> {
	let accessTokenValue = access.decrypted;
	let needsUpdate = access.wasPlaintext || refresh.wasPlaintext;

	if (token.expiresAt < new Date()) {
		const credentials = await refreshAccessToken(refresh.decrypted);
		if (credentials.access_token && credentials.expiry_date) {
			accessTokenValue = credentials.access_token;
			await db
				.update(googleCalendarToken)
				.set({
					accessToken: encrypt(credentials.access_token),
					refreshToken: encrypt(refresh.decrypted),
					expiresAt: new Date(credentials.expiry_date),
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.id, token.id));
			return accessTokenValue;
		}
		return null; // refresh failed
	}

	if (needsUpdate) {
		await db
			.update(googleCalendarToken)
			.set({
				accessToken: encrypt(accessTokenValue),
				refreshToken: encrypt(refresh.decrypted),
				updatedAt: new Date(),
			})
			.where(eq(googleCalendarToken.id, token.id));
	}

	return accessTokenValue;
}

function toValidToken(
	token: typeof googleCalendarToken.$inferSelect,
	accessTokenValue: string,
	refreshTokenValue: string,
): ValidToken {
	return {
		id: token.id,
		accessToken: accessTokenValue,
		refreshToken: refreshTokenValue,
		calendarId: token.calendarId,
		busyCalendarIds: token.busyCalendarIds ?? ["primary"],
		accountEmail: token.accountEmail,
	};
}

/**
 * Fetches the event target token for a user (isEventTarget = true).
 * Used for creating new Google Calendar events.
 * Falls back to any token if none is marked as event target.
 */
export async function getEventTargetToken(
	db: Db,
	userId: string,
): Promise<ValidToken | null> {
	// Try event target first
	let [token] = await db
		.select()
		.from(googleCalendarToken)
		.where(
			and(
				eq(googleCalendarToken.userId, userId),
				eq(googleCalendarToken.isEventTarget, true),
			),
		)
		.limit(1);

	// Fallback: any token for user
	if (!token) {
		[token] = await db
			.select()
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, userId))
			.limit(1);
	}

	if (!token) return null;

	const access = decryptToken(token.accessToken);
	const refresh = decryptToken(token.refreshToken);
	const accessTokenValue = await refreshAndSave(db, token, access, refresh);

	if (!accessTokenValue) return null;

	return toValidToken(token, accessTokenValue, refresh.decrypted);
}

/**
 * Fetches a valid token by its ID.
 * Used for confirm/cancel/sync when booking stores the token ID.
 */
export async function getValidTokenById(
	db: Db,
	tokenId: string,
): Promise<ValidToken | null> {
	const [token] = await db
		.select()
		.from(googleCalendarToken)
		.where(eq(googleCalendarToken.id, tokenId))
		.limit(1);

	if (!token) return null;

	const access = decryptToken(token.accessToken);
	const refresh = decryptToken(token.refreshToken);
	const accessTokenValue = await refreshAndSave(db, token, access, refresh);

	if (!accessTokenValue) return null;

	return toValidToken(token, accessTokenValue, refresh.decrypted);
}

/**
 * Fetches all valid tokens for a user.
 * Used for FreeBusy aggregation across multiple Google accounts.
 */
export async function getAllUserTokens(
	db: Db,
	userId: string,
): Promise<ValidToken[]> {
	const tokens = await db
		.select()
		.from(googleCalendarToken)
		.where(eq(googleCalendarToken.userId, userId));

	const result: ValidToken[] = [];

	for (const token of tokens) {
		const access = decryptToken(token.accessToken);
		const refresh = decryptToken(token.refreshToken);

		try {
			const accessTokenValue = await refreshAndSave(db, token, access, refresh);
			if (accessTokenValue) {
				result.push(toValidToken(token, accessTokenValue, refresh.decrypted));
			}
		} catch (err) {
			console.error("[google-calendar-token] Failed to process token:", token.id, err);
		}
	}

	return result;
}

/**
 * Bulk fetch valid tokens by their IDs.
 * Returns a Map<tokenId, ValidToken>.
 * Used by syncFromCalendar when bookings reference specific tokens.
 */
export async function getValidTokensByIds(
	db: Db,
	tokenIds: string[],
): Promise<Map<string, ValidToken>> {
	if (tokenIds.length === 0) return new Map();

	const tokens = await db
		.select()
		.from(googleCalendarToken)
		.where(inArray(googleCalendarToken.id, tokenIds));

	const result = new Map<string, ValidToken>();

	for (const token of tokens) {
		const access = decryptToken(token.accessToken);
		const refresh = decryptToken(token.refreshToken);

		try {
			const accessTokenValue = await refreshAndSave(db, token, access, refresh);
			if (accessTokenValue) {
				result.set(token.id, toValidToken(token, accessTokenValue, refresh.decrypted));
			}
		} catch (err) {
			console.error("[google-calendar-token] Failed to refresh token:", token.id, err);
		}
	}

	return result;
}

/**
 * Encrypts and saves (upsert) a Google Calendar token.
 * Upserts by userId + accountEmail (allows multiple accounts per user).
 * First token for a user automatically becomes the event target.
 */
export async function saveToken(
	db: Db,
	opts: {
		userId: string;
		accountEmail: string;
		accessToken: string;
		refreshToken: string;
		expiresAt: Date;
	},
): Promise<void> {
	const encryptedAccess = encrypt(opts.accessToken);
	const encryptedRefresh = encrypt(opts.refreshToken);

	// Check if this user+account combo already exists
	const existing = await db
		.select({ id: googleCalendarToken.id })
		.from(googleCalendarToken)
		.where(
			and(
				eq(googleCalendarToken.userId, opts.userId),
				eq(googleCalendarToken.accountEmail, opts.accountEmail),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(googleCalendarToken)
			.set({
				accessToken: encryptedAccess,
				refreshToken: encryptedRefresh,
				expiresAt: opts.expiresAt,
				updatedAt: new Date(),
			})
			.where(eq(googleCalendarToken.id, existing[0]!.id));
		return;
	}

	// Check if user has any existing tokens (to determine isEventTarget)
	const existingTokens = await db
		.select({ id: googleCalendarToken.id })
		.from(googleCalendarToken)
		.where(eq(googleCalendarToken.userId, opts.userId))
		.limit(1);

	const isFirstToken = existingTokens.length === 0;

	await db.insert(googleCalendarToken).values({
		userId: opts.userId,
		accountEmail: opts.accountEmail,
		accessToken: encryptedAccess,
		refreshToken: encryptedRefresh,
		expiresAt: opts.expiresAt,
		isEventTarget: isFirstToken,
	});
}
