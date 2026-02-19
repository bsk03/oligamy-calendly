"use client";

import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
	const { locale, setLocale } = useTranslation();

	return (
		<div className="fixed bottom-4 left-4 z-50 flex overflow-hidden rounded-full border bg-white shadow-sm">
			<button
				type="button"
				onClick={() => setLocale("en")}
				className={cn(
					"px-3 py-1.5 text-xs font-medium transition-colors",
					locale === "en"
						? "bg-gray-900 text-white"
						: "text-gray-500 hover:bg-gray-50",
				)}
			>
				EN
			</button>
			<button
				type="button"
				onClick={() => setLocale("pl")}
				className={cn(
					"px-3 py-1.5 text-xs font-medium transition-colors",
					locale === "pl"
						? "bg-gray-900 text-white"
						: "text-gray-500 hover:bg-gray-50",
				)}
			>
				PL
			</button>
		</div>
	);
}
