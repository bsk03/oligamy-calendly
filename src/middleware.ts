import { type NextRequest, NextResponse } from "next/server";
import { getCookieCache } from "better-auth/cookies";

const loginUrl = "/admin/login";

export async function middleware(request: NextRequest) {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		return NextResponse.redirect(new URL(loginUrl, request.url));
	}

	const cached = await getCookieCache(request, { secret });

	if (!cached?.session || !cached?.user) {
		return NextResponse.redirect(new URL(loginUrl, request.url));
	}

	// Check session expiration
	if (new Date(cached.session.expiresAt) < new Date()) {
		return NextResponse.redirect(new URL(loginUrl, request.url));
	}

	// Admin routes require admin role
	if (
		request.nextUrl.pathname.startsWith("/admin") &&
		(cached.user as { role?: string }).role !== "admin"
	) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/((?!login).*)"],
};
