import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const loginUrl = "/admin/login";

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

	if (!sessionCookie) {
		return NextResponse.redirect(new URL(loginUrl, request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/((?!login).*)"],
};
