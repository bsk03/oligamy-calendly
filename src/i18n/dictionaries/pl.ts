import type { Dictionary } from "../types";

export const pl: Dictionary = {
	bookingCalendar: {
		dayLabels: ["NIE", "PON", "WTO", "ŚRO", "CZW", "PIĄ", "SOB"],
	},
	timeSlotList: {
		noAvailableTimes: "Brak dostępnych terminów",
	},
	personEventSelector: {
		selectExpert: "Wybierz eksperta",
		host: "Prowadzący",
		members: "Członkowie",
		duration: "Czas trwania",
		min: (d) => `${d} min`,
		noMeetingTypes: "Ten ekspert nie ma jeszcze skonfigurowanych typów spotkań.",
	},
	bookingCard: {
		continue: "Dalej",
		selectDatePrompt: "Wybierz datę, aby zobaczyć\ndostępne godziny",
	},
	bookingForm: {
		nameRequired: "Imię jest wymagane",
		invalidEmail: "Nieprawidłowy adres e-mail",
		bookingConfirmedToast: "Rezerwacja potwierdzona!",
		bookingConfirmed: "Rezerwacja potwierdzona",
		meetingScheduled: (name) =>
			`Twoje spotkanie z ${name} zostało zaplanowane.`,
		confirmationSent: (email) =>
			`Potwierdzenie zostało wysłane na ${email}`,
		yourDetails: "Twoje dane",
		yourName: "Twoje imię",
		namePlaceholder: "Jan Kowalski",
		emailAddress: "Adres e-mail",
		emailPlaceholder: "jan@example.com",
		additionalNotes: "Dodatkowe uwagi",
		notesPlaceholder: "Cokolwiek, o czym prowadzący powinien wiedzieć...",
		confirmBooking: "Potwierdź rezerwację",
		back: "Wstecz",
		host: (name) => `Prowadzący: ${name}`,
		min: (d) => `${d} min`,
	},
};
