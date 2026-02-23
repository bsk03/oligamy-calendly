import type { Dictionary } from "../types";

export const en: Dictionary = {
	bookingPage: {
		title: "Book a meeting",
	},
	bookingCalendar: {
		dayLabels: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
	},
	timeSlotList: {
		noAvailableTimes: "No available times",
	},
	personEventSelector: {
		selectExpert: "Select Expert",
		host: "Host",
		members: "Members",
		duration: "Duration",
		min: (d) => `${d} min`,
		noMeetingTypes: "This expert has no meeting types configured yet.",
	},
	bookingCard: {
		continue: "Continue",
		selectDatePrompt: "Select a date to see\navailable times",
	},
	bookingForm: {
		nameRequired: "Name is required",
		invalidEmail: "Invalid email address",
		bookingConfirmedToast: "Booking confirmed!",
		bookingConfirmed: "Booking confirmed",
		meetingScheduled: (name) =>
			`Your meeting with ${name} has been scheduled.`,
		confirmationSent: (email) =>
			`A confirmation has been sent to ${email}`,
		yourDetails: "Your details",
		yourName: "Your name",
		namePlaceholder: "John Doe",
		emailAddress: "Email address",
		emailPlaceholder: "john@example.com",
		additionalNotes: "Additional notes",
		notesPlaceholder: "Anything the host should know...",
		confirmBooking: "Confirm booking",
		back: "Back",
		host: (name) => `Host: ${name}`,
		min: (d) => `${d} min`,
	},
};
