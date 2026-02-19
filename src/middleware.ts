import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	const sessionCookie = request.cookies.get("better-auth.session_token");

	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/admin/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/((?!login).*)"],
};
