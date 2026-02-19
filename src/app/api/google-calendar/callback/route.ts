import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { googleCalendarToken } from "@/server/db/schema";
import { getTokensFromCode } from "@/server/lib/google-calendar";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	if (error || !code) {
		return NextResponse.redirect(
			new URL("/admin/integrations?error=google_denied", request.url),
		);
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		return NextResponse.redirect(
			new URL("/admin/login?error=unauthenticated", request.url),
		);
	}

	try {
		const tokens = await getTokensFromCode(code);

		if (!tokens.access_token || !tokens.refresh_token) {
			return NextResponse.redirect(
				new URL("/admin/integrations?error=no_tokens", request.url),
			);
		}

		const expiresAt = tokens.expiry_date
			? new Date(tokens.expiry_date)
			: new Date(Date.now() + 3600 * 1000);

		const existing = await db
			.select({ id: googleCalendarToken.id })
			.from(googleCalendarToken)
			.where(eq(googleCalendarToken.userId, session.user.id))
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(googleCalendarToken)
				.set({
					accessToken: tokens.access_token,
					refreshToken: tokens.refresh_token,
					expiresAt,
					updatedAt: new Date(),
				})
				.where(eq(googleCalendarToken.userId, session.user.id));
		} else {
			await db.insert(googleCalendarToken).values({
				userId: session.user.id,
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				expiresAt,
			});
		}

		return NextResponse.redirect(
			new URL("/admin/integrations?success=google_connected", request.url),
		);
	} catch (e) {
		console.error("Google Calendar OAuth error:", e);
		return NextResponse.redirect(
			new URL("/admin/integrations?error=exchange_failed", request.url),
		);
	}
}
