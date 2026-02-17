# Oligamy Cal — Wewnętrzna Aplikacja do Umawiania Spotkań

## 🎯 Czym jest ta aplikacja

**Oligamy Cal** to wewnętrzna aplikacja dla Twojej firmy. Współpracownicy zakładają konta i pojawiają się na **stronie głównej**, gdzie można wybrać osobę i umówić się z nią na spotkanie.

### Główne elementy

1. **Strona główna** — lista współpracowników dostępnych do umówienia (karty z imieniem, zdjęciem, linkiem „Umów się”).
2. **Panel współpracownika (dashboard)** — dla osób, które udostępniają swój kalendarz: dostępność, typy spotkań, integracja z Google Calendar, lista rezerwacji.
3. **Widok rezerwacji (Booking)** — wybór terminu i potwierdzenie spotkania z wybranym współpracownikiem.

**Przykład flow:** Jan Kowalski zakłada konto → ustawia dostępność (np. pon–pt 9:00–17:00) i typ spotkania (np. 30 min) → pojawia się na stronie głównej → osoba chętna się umówić klika „Umów się”, wybiera datę i godzinę → rezerwacja jest zapisana, dodana do google calendar, wraz z utworzonym google meetem. obie strony dostają potwierdzenie.

---

## 🏗️ Architektura techniczna (T3 Stack)

### Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **API**: **tRPC 11** (procedury w `src/server/api/routers/`)
- **Baza danych**: PostgreSQL + **Drizzle ORM**
- **Auth**: **better-auth** (email/hasło)
- **Walidacja**: Zod (w procedurach tRPC)
- **Zmienne środowiskowe**: `@t3-oss/env-nextjs` (plik `src/env.js`)
- **Google Calendar**: googleapis (do integracji kalendarza)
- **Email**: Nodemailer
- **Deployment**: Vercel + PostgreSQL

### Struktura plików (T3)

```
src/
├── app/
│   ├── (public)/                    # Strony bez wymagania logowania
│   │   ├── page.tsx                 # STRONA GŁÓWNA — lista współpracowników do umówienia
│   │   └── layout.tsx
│   ├── (dashboard)/                 # Panel współpracownika (wymaga auth)
│   │   ├── dashboard/
│   │   │   ├── page.tsx             # Dashboard: podsumowanie, link do bookingu
│   │   │   ├── availability/
│   │   │   │   └── page.tsx         # Dostępność tygodniowa
│   │   │   ├── event-types/
│   │   │   │   └── page.tsx         # Typy spotkań (np. Konsultacja 30 min)
│   │   │   ├── integrations/
│   │   │   │   └── page.tsx         # Google Calendar
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx         # Lista rezerwacji
│   │   │   └── settings/
│   │   │       └── page.tsx         # Profil, zdjęcie, strefa czasowa
│   │   └── layout.tsx               # Layout z nawigacją dashboardu
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── book/
│   │   └── [username]/
│   │       ├── page.tsx             # Wybór typu spotkania + data/godzina + formularz
│   │       └── confirmation/
│   │           └── page.tsx         # Potwierdzenie po rezerwacji (np. ?token=...)
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.ts         # better-auth handler
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts         # tRPC handler
│   └── layout.tsx
├── server/
│   ├── api/
│   │   ├── trpc.ts                  # Kontekst tRPC (session, db)
│   │   ├── root.ts                  # appRouter — agregacja routerów
│   │   └── routers/
│   │   ├── user.ts                  # user.list (publiczni współpracownicy), user.byUsername
│   │   ├── availability.ts          # availability.set, availability.get, slots.get (public)
│   │   ├── eventType.ts             # eventType.list, eventType.create, ...
│   │   ├── booking.ts               # booking.create (public), booking.list (dla hosta)
│   │   └── post.ts                  # (istniejący — do usunięcia lub zostawienia)
│   ├── db/
│   │   ├── index.ts                 # Drizzle client
│   │   └── schema.ts                # Tabele: user, session, account + availability, eventType, booking, ...
│   ├── better-auth/
│   │   ├── config.ts
│   │   ├── server.ts
│   │   ├── client.ts
│   │   └── index.ts
│   └── lib/                         # Opcjonalnie: logika poza tRPC
│       ├── google-calendar.ts       # FreeBusy, tworzenie eventów
│       ├── availability.ts         # Obliczanie wolnych slotów
│       └── email.ts                 # Resend / Nodemailer
├── trpc/
│   ├── react.tsx                    # api — hook do wywołań tRPC
│   ├── server.ts                    # api — server-side caller
│   └── query-client.ts
├── components/
│   ├── dashboard/
│   │   ├── AvailabilityEditor.tsx
│   │   ├── EventTypesList.tsx
│   │   ├── GoogleCalendarConnect.tsx
│   │   └── BookingsList.tsx
│   ├── booking/
│   │   ├── DatePicker.tsx
│   │   ├── TimeSlots.tsx
│   │   ├── BookingForm.tsx
│   │   └── ConfirmationView.tsx
│   ├── home/
│   │   └── CoworkerCard.tsx         # Karta współpracownika na stronie głównej
│   └── ui/                          # shadcn/ui lub własne
│       ├── Button.tsx
│       ├── Input.tsx
│       └── ...
├── env.js                           # @t3-oss/env-nextjs
└── styles/
    └── globals.css
```

### Konwencje tRPC

- **Procedury publiczne** (bez wymagania sesji): np. `user.list`, `slots.get`, `booking.create` — używane na stronie głównej i w flow bookingu.
- **Procedury chronione** (wymagają sesji): np. `availability.set`, `eventType.create`, `booking.list` — tylko dla zalogowanego właściciela zasobu.
- W `server/api/trpc.ts`: kontekst z `db` i `session` (z better-auth); w procedurach sprawdzać `ctx.session?.user.id` przy operacjach na własnych danych.

---

## 🗃️ Schemat bazy danych (Drizzle)

Plik: `src/server/db/schema.ts`. Tabele better-auth (`user`, `session`, `account`, `verification`) są już zdefiniowane. Poniżej tabele domenowe — dodać je w tym samym pliku (lub wydzielić do `schema/` i re-eksportować).

**Uzupełnienie modelu `user` (better-auth):**  
Dodać kolumny (migracja): `username` (unique), `bio`, `avatarUrl`, `timezone`, `isVisibleOnHome` (boolean — czy pokazywać na stronie głównej). Albo osobna tabela `profiles` powiązana z `user.id`.

```ts
// Rozszerzenie / dodatkowe tabele (Drizzle)

// Profil współpracownika (jeśli nie rozszerzasz user)
export const profile = createTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	username: text('username').notNull().unique(),
	bio: text('bio'),
	avatarUrl: text('avatar_url'),
	timezone: text('timezone').notNull().default('Europe/Warsaw'),
	isVisibleOnHome: boolean('is_visible_on_home').notNull().default(true),
	createdAt: timestamp('created_at')
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp('updated_at')
		.$defaultFn(() => new Date())
		.notNull(),
});

// Typ spotkania (np. "Konsultacja 30 min")
export const eventType = createTable('event_type', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()), // lub uuid
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	slug: text('slug').notNull(),
	durationMinutes: integer('duration_minutes').notNull(),
	description: text('description'),
	location: text('location'),
	color: text('color').default('#3B82F6'),
	isActive: boolean('is_active').notNull().default(true),
	bookingWindowDays: integer('booking_window_days').notNull().default(30),
	minimumNoticeHours: integer('minimum_notice_hours').notNull().default(24),
	createdAt: timestamp('created_at')
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp('updated_at')
		.$defaultFn(() => new Date())
		.notNull(),
});

// Dostępność tygodniowa (dzień tygodnia + godziny)
export const availability = createTable('availability', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	dayOfWeek: integer('day_of_week').notNull(), // 0–6
	startTime: text('start_time').notNull(), // "09:00"
	endTime: text('end_time').notNull(),
	isAvailable: boolean('is_available').notNull().default(true),
});

// Wyjątki (urlop, inna dostępność w danym dniu)
export const availabilityOverride = createTable('availability_override', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	date: date('date').notNull(),
	isAvailable: boolean('is_available').notNull(),
	startTime: text('start_time'),
	endTime: text('end_time'),
	reason: text('reason'),
});

// Rezerwacja
export const booking = createTable('booking', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	hostId: text('host_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	eventTypeId: text('event_type_id')
		.notNull()
		.references(() => eventType.id),
	guestName: text('guest_name').notNull(),
	guestEmail: text('guest_email').notNull(),
	guestPhone: text('guest_phone'),
	guestNotes: text('guest_notes'),
	startTime: timestamp('start_time', { withTimezone: true }).notNull(),
	endTime: timestamp('end_time', { withTimezone: true }).notNull(),
	timezone: text('timezone').notNull(),
	status: text('status').notNull().default('PENDING'), // PENDING | CONFIRMED | CANCELLED | COMPLETED
	googleEventId: text('google_event_id'),
	meetLink: text('meet_link'),
	cancelToken: text('cancel_token')
		.notNull()
		.unique()
		.$defaultFn(() => createId()),
	rescheduleToken: text('reschedule_token')
		.notNull()
		.unique()
		.$defaultFn(() => createId()),
	createdAt: timestamp('created_at')
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp('updated_at')
		.$defaultFn(() => new Date())
		.notNull(),
});

// Token Google Calendar (OAuth)
export const googleCalendarToken = createTable('google_calendar_token', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token').notNull(),
	refreshToken: text('refresh_token').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	calendarId: text('calendar_id').notNull().default('primary'),
	busyCalendarIds: text('busy_calendar_ids').array().default(['primary']),
	createdAt: timestamp('created_at')
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: timestamp('updated_at')
		.$defaultFn(() => new Date())
		.notNull(),
});
```

Relacje Drizzle (`relations`) dodać dla `profile`, `eventType`, `availability`, `booking`, `googleCalendarToken` do `user` oraz dla `booking` do `eventType`.  
Uwaga: jeśli używasz `createTable` z prefiksem (np. `pg-drizzle_`), zachowaj spójność z resztą schematu.

---

## 🔑 Zmienne środowiskowe

W `src/env.js` (createEnv) dodać m.in.:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
NODE_ENV="development"

# Google OAuth + Calendar (gdy dodasz integrację)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

# Email (Resend)
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@twoja-firma.pl"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

W `env.js` zadeklarować nowe zmienne w `server` / `client` i `runtimeEnv`.

---

## 📄 Strona główna

- **URL:** `/` (route group `(public)`).
- **Zawartość:**
  - Nagłówek (np. „Umów się z zespołem” / logo firmy).
  - Lista współpracowników: tylko użytkownicy z kontem, którzy mają włączone „widoczność na stronie głównej” (np. `isVisibleOnHome === true`).
  - Dla każdego: zdjęcie (avatar), imię i nazwisko, krótka bio (opcjonalnie), przycisk/link **„Umów się”** → `/book/[username]`.
- **Dane:** procedura tRPC `user.list` (publiczna) zwracająca listę profili z `isVisibleOnHome === true` (bez wrażliwych danych).

---

## 📋 Funkcjonalności — skrót

### Rejestracja / logowanie (better-auth)

- Rejestracja: email, hasło, imię; username generowany z imienia (np. `jan-kowalski`), unikalność w bazie.
- Logowanie: email + hasło; opcjonalnie „Zaloguj przez Google”.

### Panel współpracownika (dashboard)

- **Dashboard:** podsumowanie rezerwacji, nadchodzące spotkania, link do swojego bookingu (`/book/[username]`), status Google Calendar.
- **Dostępność:** tygodniowy edytor (dni + godziny), wyjątki (np. urlop).
- **Typy spotkań:** CRUD; tytuł, czas trwania, opis, lokalizacja; każdy typ ma slug w URL bookingu.
- **Integracja Google Calendar:** OAuth, wybór kalendarzy do sprawdzania zajętości, odświeżanie tokenu.
- **Rezerwacje:** lista z filtrami; anulowanie; opcjonalnie eksport CSV.
- **Ustawienia:** edycja profilu (imię, bio, avatar, timezone), widoczność na stronie głównej, zmiana hasła.

### Booking (publiczny)

- **`/book/[username]`:** wybór typu spotkania (jeśli kilka) → wybór daty → wybór godziny (sloty z tRPC `slots.get`) → formularz (imię, email, telefon, uwagi) → potwierdzenie.
- **Potwierdzenie:** strona „Spotkanie zarezerwowane” + emaile do gościa i hosta (Resend).
- **Anulowanie / przełożenie:** linki w emailu z tokenem (publiczne procedury tRPC lub osobne API route z tokenem).

---

## 🔧 Kluczowe algorytmy

### Wolne sloty (slots.get)

- Wejście: `userId` (host), `eventTypeId`, `date`.
- Pobierz event type (duration, min notice).
- Sprawdź dostępność tygodniową na ten dzień i ewentualny override.
- Pobierz zajęte okresy: Google Calendar FreeBusy + istniejące rezerwacje z bazy.
- Wygeneruj sloty co N minut w oknie pracy; odfiltruj zajęte i te przed `now + minimumNoticeHours`.
- Zwróć listę slotów (np. `{ start: Date, end: Date }[]`).

### Google Calendar

- FreeBusy do sprawdzania zajętości; przy tworzeniu rezerwacji — tworzenie eventu w kalendarzu hosta (Meet link). Przed każdym wywołaniem sprawdzać `expiresAt` i odświeżać token.

---

## 🚀 Kolejność implementacji

### Faza 1 — Fundament

1. Rozszerzenie schematu Drizzle (profile, eventType, availability, availabilityOverride, booking, googleCalendarToken) + migracje.
2. Rozszerzenie `env.js` o zmienne Google, Resend, `NEXT_PUBLIC_APP_URL`.
3. Routery tRPC: `user` (list publicznych współpracowników, byUsername), kontekst z sesją.

### Faza 2 — Strona główna i profil

4. Strona główna: lista współpracowników z `user.list`, komponent `CoworkerCard`, link „Umów się” → `/book/[username]`.
5. Rejestracja: ustawianie profilu (username, isVisibleOnHome); dashboard layout i nawigacja.
6. Dashboard: strona główna dashboardu, ustawienia profilu (edycja, widoczność na stronie).

### Faza 3 — Dostępność i typy spotkań

7. Routery: `availability`, `eventType` (CRUD, z sprawdzeniem `ctx.session.user.id`).
8. UI: edytor dostępności, lista/edycja typów spotkań.

### Faza 4 — Google Calendar

9. OAuth Google (better-auth lub osobny flow), zapis tokenu w `googleCalendarToken`.
10. FreeBusy + logika slotów w `server/lib/availability.ts` (wywołana z procedury `slots.get`).
11. Przy tworzeniu rezerwacji — tworzenie eventu w Google Calendar.

### Faza 5 — Booking publiczny

12. Strony `/book/[username]`: wybór typu → data → godzina (slots.get) → formularz.
13. Procedura `booking.create` (publiczna): walidacja slotu, transakcja (insert rezerwacji), opcjonalnie event w Google.
14. Strona potwierdzenia; emaile (Resend): potwierdzenie dla gościa i hosta, linki anuluj/przełóż.

### Faza 6 — Dokończenie

15. Lista rezerwacji w dashboardzie (`booking.list` dla hosta).
16. Anulowanie przez token (procedura publiczna lub route).
17. Ustawienia profilu: avatar, timezone, zmiana hasła.

---

## ⚠️ Ważne uwagi

1. **Strona główna** — tylko użytkownicy z kontem i z włączoną widocznością; żadnych wrażliwych danych w `user.list`.
2. **Timezone** — daty w bazie w UTC; konwersja przy wyświetlaniu (np. date-fns-tz / luxon).
3. **Token Google** — sprawdzać `expiresAt` i odświeżać przed wywołaniami API.
4. **Race przy rezerwacji** — użyć transakcji Drizzle przy `booking.create`, żeby nie zduplikować slotu.
5. **Walidacja** — każda procedura modyfikująca dane hosta weryfikuje `ctx.session?.user.id === resource.userId`.
6. **Username** — unikalny, generowany przy rejestracji (np. slug z imienia + suffix jeśli zajęty).

---

## 📦 Zależności (już w projekcie / do dodania)

Obecne: `next`, `@trpc/client`, `@trpc/react-query`, `@trpc/server`, `drizzle-orm`, `better-auth`, `@t3-oss/env-nextjs`, `zod`, `superjson`, `@tanstack/react-query`.

Do dodania przy rozbudowie:

- `googleapis` — Google Calendar
- `resend` — emaile
- `date-fns`, `date-fns-tz` — daty i strefy czasowe
- Komponenty UI: np. `react-day-picker` lub `@radix-ui/react-calendar`, shadcn/ui

---

_Ten brief opisuje aplikację wewnętrzną (Oligamy Cal) w stacku T3: strona główna z listą współpracowników, panel współpracownika (dashboard) i publiczny flow rezerwacji. Implementację zacznij od Fazy 1 i idź po kolei._
