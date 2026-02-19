"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/trpc/react";

import { BookingCalendar } from "./BookingCalendar";
import { BookingForm } from "./BookingForm";
import { PersonEventSelector } from "./PersonEventSelector";
import { TimeSlotList } from "./TimeSlotList";

type Step = "select" | "form";

export function BookingCard() {
	const [step, setStep] = useState<Step>("select");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [selectedDuration, setSelectedDuration] = useState<number | null>(
		null,
	);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [currentMonth, setCurrentMonth] = useState<Date>(
		new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	);
	const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
	const [timezone, setTimezone] = useState("Europe/Warsaw");

	// Fetch users
	const { data: people = [] } = api.user.list.useQuery();

	// Derive selected event type from person + duration
	const selectedPerson = people.find((p) => p.userId === selectedUserId);
	const selectedEventType =
		selectedPerson?.eventTypes.find(
			(et) => et.durationMinutes === selectedDuration,
		) ?? null;
	const selectedEventTypeId = selectedEventType?.id ?? null;

	// Fetch available dates for the displayed month
	const { data: availableDates = [], isLoading: isDatesLoading } =
		api.slots.getAvailableDates.useQuery(
			{
				userId: selectedUserId!,
				eventTypeId: selectedEventTypeId!,
				year: currentMonth.getFullYear(),
				month: currentMonth.getMonth() + 1,
			},
			{
				enabled: !!selectedUserId && !!selectedEventTypeId,
			},
		);

	// Prefetch next month so navigation is instant
	const nextMonth = useMemo(
		() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
		[currentMonth],
	);
	api.slots.getAvailableDates.useQuery(
		{
			userId: selectedUserId!,
			eventTypeId: selectedEventTypeId!,
			year: nextMonth.getFullYear(),
			month: nextMonth.getMonth() + 1,
		},
		{
			enabled: !!selectedUserId && !!selectedEventTypeId,
		},
	);

	// Fetch available slots for the selected date
	const { data: slots = [], isLoading: isSlotsLoading } =
		api.slots.getAvailableSlots.useQuery(
			{
				userId: selectedUserId!,
				eventTypeId: selectedEventTypeId!,
				date: selectedDate!,
			},
			{
				enabled:
					!!selectedUserId && !!selectedEventTypeId && !!selectedDate,
			},
		);

	const availableDatesSet = useMemo(
		() => new Set(availableDates),
		[availableDates],
	);

	// Find the full slot object for the selected slot
	const selectedSlotObj = slots.find((s) => s.start === selectedSlot) ?? null;

	const canProceed =
		!!selectedPerson &&
		!!selectedEventType &&
		!!selectedDate &&
		!!selectedSlotObj;

	const handleUserChange = (userId: string) => {
		setSelectedUserId(userId);
		setSelectedDuration(null);
		setSelectedDate(null);
		setSelectedSlot(null);
	};

	const handleDurationChange = (duration: number) => {
		setSelectedDuration(duration);
		setSelectedDate(null);
		setSelectedSlot(null);
	};

	const handleDateSelect = (date: string) => {
		setSelectedDate(date);
		setSelectedSlot(null);
	};

	const handleSlotSelect = (slot: { start: string; end: string }) => {
		setSelectedSlot(slot.start);
	};

	const handleMonthChange = (date: Date) => {
		setCurrentMonth(date);
		setSelectedDate(null);
		setSelectedSlot(null);
	};

	const handleBack = () => {
		setStep("select");
	};

	// Step 2: Booking form
	if (
		step === "form" &&
		selectedPerson &&
		selectedEventType &&
		selectedDate &&
		selectedSlotObj
	) {
		return (
			<BookingForm
				host={selectedPerson}
				eventType={selectedEventType}
				slot={selectedSlotObj}
				date={selectedDate}
				timezone={timezone}
				onBack={handleBack}
			/>
		);
	}

	// Step 1: Date & time picker
	return (
		<Card className="w-full max-w-5xl">
			<CardContent>
				<div className="flex h-[480px] flex-col md:flex-row">
					{/* Left: Person, Info, Duration, Timezone */}
					<div className="w-full shrink-0 overflow-y-auto pb-5 md:w-[240px] md:border-r md:pb-0 md:pr-6">
						<PersonEventSelector
							people={people}
							selectedUserId={selectedUserId}
							selectedDuration={selectedDuration}
							selectedEventType={selectedEventType}
							onUserChange={handleUserChange}
							onDurationChange={handleDurationChange}
							timezone={timezone}
							onTimezoneChange={setTimezone}
						/>
					</div>

					{/* Middle: Calendar */}
					<div className="shrink-0 border-t py-5 md:border-t-0 md:px-6 md:py-0">
						<BookingCalendar
							currentMonth={currentMonth}
							availableDates={availableDatesSet}
							selectedDate={selectedDate}
							isLoading={isDatesLoading}
							onDateSelect={handleDateSelect}
							onMonthChange={handleMonthChange}
						/>
					</div>

					{/* Right: Time Slots + Continue */}
					<div className="flex w-full shrink-0 flex-col overflow-hidden border-t pt-5 md:w-[200px] md:min-h-0 md:border-t-0 md:border-l md:pl-6 md:pt-0">
						{selectedDate ? (
							<>
								<TimeSlotList
									slots={slots}
									selectedSlot={selectedSlot}
									isLoading={isSlotsLoading}
									onSlotSelect={handleSlotSelect}
									dateString={selectedDate}
									timeFormat={timeFormat}
									onTimeFormatChange={setTimeFormat}
									timezone={timezone}
								/>

								{canProceed && (
									<Button
										onClick={() => setStep("form")}
										className="mt-4 w-full shrink-0"
									>
										Continue
										<ArrowRight className="size-4" />
									</Button>
								)}
							</>
						) : (
							<div className="flex h-full items-center justify-center">
								<p className="text-center text-[13px] text-muted-foreground">
									Select a date to see
									<br />
									available times
								</p>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
