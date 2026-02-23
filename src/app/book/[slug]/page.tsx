import { notFound } from "next/navigation";

import { BookingCard } from "@/components/booking/BookingCard";
import { BookingFooter } from "@/components/booking/BookingFooter";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { LanguageSwitcher } from "@/components/booking/LanguageSwitcher";
import { LocaleProvider } from "@/i18n/context";
import { api, HydrateClient } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface BookPageProps {
	params: Promise<{ slug: string }>;
}

/**
 * Path-based booking page: /book/[slug]
 * Tries group first, then personal username.
 */
export default async function BookPage({ params }: BookPageProps) {
	const { slug } = await params;

	let groupSlug: string | null = null;
	let username: string | null = null;
	let defaultLocale = "en";

	// First try group, then user
	const groupData = await api.group.bySlug({ slug });
	if (groupData) {
		groupSlug = slug;
		defaultLocale = groupData.host?.defaultLocale ?? "en";
		void api.group.bySlug.prefetch({ slug });
	} else {
		const person = await api.user.byUsername({ username: slug });
		if (!person) {
			notFound();
		}
		username = slug;
		defaultLocale = person.defaultLocale;
		void api.user.byUsername.prefetch({ username: slug });
	}

	return (
		<HydrateClient>
			<LocaleProvider defaultLocale={defaultLocale}>
				<main className="flex min-h-svh flex-col items-center justify-center bg-background px-3 py-6 md:p-4">
					<div className="flex w-full max-w-5xl flex-col items-center gap-6">
						<BookingHeader />
						<BookingCard
							username={groupSlug ? null : username}
							groupSlug={groupSlug}
						/>
						<BookingFooter />
					</div>
				</main>
				<LanguageSwitcher />
			</LocaleProvider>
		</HydrateClient>
	);
}
