"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

import type { Dictionary, Locale } from "./types";
import { en } from "./dictionaries/en";
import { pl } from "./dictionaries/pl";

const STORAGE_KEY = "oligamy-cal-locale";

const dictionaries: Record<Locale, Dictionary> = { en, pl };
const intlLocales: Record<Locale, string> = { en: "en-US", pl: "pl-PL" };

interface LocaleContextValue {
	locale: Locale;
	setLocale: (l: Locale) => void;
	t: Dictionary;
	intlLocale: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
	defaultLocale?: string;
	children: ReactNode;
}

function resolveLocale(value: string | null | undefined): Locale {
	if (value === "pl" || value === "en") return value;
	return "en";
}

export function LocaleProvider({
	defaultLocale,
	children,
}: LocaleProviderProps) {
	const [locale, setLocaleState] = useState<Locale>(() =>
		resolveLocale(defaultLocale),
	);

	// On mount, check localStorage override
	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved === "en" || saved === "pl") {
				setLocaleState(saved);
			}
		} catch {
			// localStorage unavailable
		}
	}, []);

	const setLocale = useCallback((l: Locale) => {
		setLocaleState(l);
		try {
			localStorage.setItem(STORAGE_KEY, l);
		} catch {
			// localStorage unavailable
		}
	}, []);

	const value: LocaleContextValue = {
		locale,
		setLocale,
		t: dictionaries[locale],
		intlLocale: intlLocales[locale],
	};

	return (
		<LocaleContext.Provider value={value}>
			{children}
		</LocaleContext.Provider>
	);
}

export function useTranslation(): LocaleContextValue {
	const ctx = useContext(LocaleContext);
	if (!ctx) {
		// Fallback for components outside provider (e.g., admin panel)
		return {
			locale: "en",
			setLocale: () => {},
			t: dictionaries.en,
			intlLocale: intlLocales.en,
		};
	}
	return ctx;
}
