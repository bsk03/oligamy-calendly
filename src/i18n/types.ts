export type Locale = "en" | "pl";

export interface Dictionary {
	bookingCalendar: {
		dayLabels: [string, string, string, string, string, string, string];
	};
	timeSlotList: {
		noAvailableTimes: string;
	};
	personEventSelector: {
		selectExpert: string;
		host: string;
		members: string;
		duration: string;
		min: (d: number) => string;
		noMeetingTypes: string;
	};
	bookingCard: {
		continue: string;
		selectDatePrompt: string;
	};
	bookingForm: {
		nameRequired: string;
		invalidEmail: string;
		bookingConfirmedToast: string;
		bookingConfirmed: string;
		meetingScheduled: (name: string) => string;
		confirmationSent: (email: string) => string;
		yourDetails: string;
		yourName: string;
		namePlaceholder: string;
		emailAddress: string;
		emailPlaceholder: string;
		additionalNotes: string;
		notesPlaceholder: string;
		confirmBooking: string;
		back: string;
		host: (name: string) => string;
		min: (d: number) => string;
	};
}
