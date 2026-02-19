import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { getGoogleAccountEmail, getTokensFromCode } from "@/server/lib/google-calendar";
import { saveToken } from "@/server/lib/google-calendar-token";

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

		const accountEmail = await getGoogleAccountEmail(tokens.access_token);

		await saveToken(db, {
			userId: session.user.id,
			accountEmail,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt,
		});

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
