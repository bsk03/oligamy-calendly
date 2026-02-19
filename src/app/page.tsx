import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BookingCard } from "@/components/booking/BookingCard";
import { env } from "@/env";
import { api, HydrateClient } from "@/trpc/server";

export const dynamic = "force-dynamic";

/**
 * Extracts the subdomain from the Host header using the app's base URL.
 * e.g. "kowalczyk.localhost:3000" with base "http://localhost:3000" → "kowalczyk"
 * e.g. "kowalczyk.book-cal.com" with base "https://book-cal.com" → "kowalczyk"
 * Returns null if no subdomain or it matches the base exactly.
 */
function getSubdomain(host: string, appUrl: string): string | null {
	const baseHost = new URL(appUrl).host; // e.g. "localhost:3000" or "book-cal.com"

	if (host === baseHost) return null;

	// Check if host ends with .baseHost
	if (host.endsWith(`.${baseHost}`)) {
		const sub = host.slice(0, -(baseHost.length + 1)); // strip ".baseHost"
		if (sub && !sub.includes(".")) return sub;
	}

	return null;
}

export default async function Home() {
	const headersList = await headers();
	const host = headersList.get("host") ?? "";
	const subdomain = getSubdomain(host, env.NEXT_PUBLIC_APP_URL);

	let groupSlug: string | null = null;

	if (subdomain) {
		// First try group, then user
		const groupData = await api.group.bySlug({ slug: subdomain });
		if (groupData) {
			groupSlug = subdomain;
			void api.group.bySlug.prefetch({ slug: subdomain });
		} else {
			const person = await api.user.byUsername({ username: subdomain });
			if (!person) {
				redirect(env.NEXT_PUBLIC_APP_URL);
			}
			void api.user.byUsername.prefetch({ username: subdomain });
		}
	} else {
		void api.user.list.prefetch();
	}

	return (
		<HydrateClient>
			<main className="flex min-h-svh flex-col items-center justify-center bg-background px-3 py-6 md:p-4">
				<div className="flex w-full max-w-5xl flex-col items-center gap-6">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src="/logo.svg"
						alt="Oligamy Software"
						className="h-8 w-auto"
					/>
					<BookingCard
						username={groupSlug ? null : subdomain}
						groupSlug={groupSlug}
					/>
				</div>
			</main>
		</HydrateClient>
	);
}
