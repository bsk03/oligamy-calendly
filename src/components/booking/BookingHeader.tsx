"use client";

import { useTranslation } from "@/i18n/context";

export function BookingHeader() {
	const { t } = useTranslation();

	return (
		<h1 className="text-lg font-semibold tracking-tight">
			{t.bookingPage.title}
		</h1>
	);
}
