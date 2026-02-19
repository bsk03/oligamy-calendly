"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/i18n/context";
import { api } from "@/trpc/react";

import { BookingCalendar } from "./BookingCalendar";
import { BookingForm } from "./BookingForm";
import { PersonEventSelector } from "./PersonEventSelector";
import { TimeSlotList } from "./TimeSlotList";

type Step = "select" | "form";

interface BookingCardProps {
	username?: string | null;
	groupSlug?: string | null;
}

export function BookingCard({ username, groupSlug }: BookingCardProps) {
	const { t } = useTranslation();
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

	const isGroupMode = !!groupSlug;

	// ── Group mode data ──
	const { data: groupData, isLoading: isGroupLoading } =
		api.group.bySlug.useQuery(
			{ slug: groupSlug! },
			{ enabled: isGroupMode },
		);

	// Derive group event type from selected duration
	const groupEventType =
		groupData?.eventTypes.find(
			(et) => et.durationMinutes === selectedDuration,
		) ?? null;
	const groupEventTypeId = groupEventType?.id ?? null;

	// ── Single-person mode ──
	const { data: singlePerson, isLoading: isSinglePersonLoading } =
		api.user.byUsername.useQuery(
			{ username: username! },
			{ enabled: !!username && !isGroupMode },
		);

	// ── Team mode ──
	const { data: allPeople = [] } = api.user.list.useQuery(undefined, {
		enabled: !username && !isGroupMode,
	});

	// Unified people list (non-group mode)
	const people = username
		? singlePerson
			? [singlePerson]
			: []
		: allPeople;

	const isLocked = !!username || isGroupMode;

	// Auto-select single person
	useEffect(() => {
		if (!isGroupMode && isLocked && singlePerson && selectedUserId !== singlePerson.userId) {
			setSelectedUserId(singlePerson.userId);
		}
	}, [isGroupMode, isLocked, singlePerson, selectedUserId]);

	// Derive selected event type from person + duration (non-group mode)
	const selectedPerson = people.find((p) => p.userId === selectedUserId);
	const selectedEventType =
		selectedPerson?.eventTypes.find(
			(et) => et.durationMinutes === selectedDuration,
		) ?? null;
	const selectedEventTypeId = selectedEventType?.id ?? null;

	// ── Available dates ──
	const { data: availableDates = [], isLoading: isDatesLoading } = isGroupMode
		? // eslint-disable-next-line react-hooks/rules-of-hooks
			api.slots.getAvailableDatesForGroup.useQuery(
				{
					groupEventTypeId: groupEventTypeId!,
					year: currentMonth.getFullYear(),
					month: currentMonth.getMonth() + 1,
				},
				{ enabled: !!groupEventTypeId },
			)
		: // eslint-disable-next-line react-hooks/rules-of-hooks
			api.slots.getAvailableDates.useQuery(
				{
					userId: selectedUserId!,
					eventTypeId: selectedEventTypeId!,
					year: currentMonth.getFullYear(),
					month: currentMonth.getMonth() + 1,
				},
				{ enabled: !!selectedUserId && !!selectedEventTypeId },
			);

	// Prefetch next month
	const nextMonth = useMemo(
		() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
		[currentMonth],
	);

	if (isGroupMode) {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		api.slots.getAvailableDatesForGroup.useQuery(
			{
				groupEventTypeId: groupEventTypeId!,
				year: nextMonth.getFullYear(),
				month: nextMonth.getMonth() + 1,
			},
			{ enabled: !!groupEventTypeId },
		);
	} else {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		api.slots.getAvailableDates.useQuery(
			{
				userId: selectedUserId!,
				eventTypeId: selectedEventTypeId!,
				year: nextMonth.getFullYear(),
				month: nextMonth.getMonth() + 1,
			},
			{ enabled: !!selectedUserId && !!selectedEventTypeId },
		);
	}

	// ── Available slots for selected date ──
	const { data: slots = [], isLoading: isSlotsLoading } = isGroupMode
		? // eslint-disable-next-line react-hooks/rules-of-hooks
			api.slots.getAvailableSlotsForGroup.useQuery(
				{
					groupEventTypeId: groupEventTypeId!,
					date: selectedDate!,
				},
				{ enabled: !!groupEventTypeId && !!selectedDate },
			)
		: // eslint-disable-next-line react-hooks/rules-of-hooks
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

	const selectedSlotObj = slots.find((s) => s.start === selectedSlot) ?? null;

	const canProceed = isGroupMode
		? !!groupEventType && !!selectedDate && !!selectedSlotObj
		: !!selectedPerson &&
			!!selectedEventType &&
			!!selectedDate &&
			!!selectedSlotObj;

	const handleUserChange = (userId: string) => {
		if (isLocked) return;
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

	// Loading state
	if ((username && !isGroupMode && isSinglePersonLoading) || (isGroupMode && isGroupLoading)) {
		return (
			<Card className="w-full max-w-5xl">
				<CardContent>
					<div className="flex flex-col md:h-[480px] md:flex-row">
						<div className="w-full shrink-0 space-y-5 pb-5 md:w-[240px] md:border-r md:pb-0 md:pr-6">
							<div className="flex items-center gap-3">
								<div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-28 animate-pulse rounded bg-muted" />
									<div className="h-3 w-20 animate-pulse rounded bg-muted" />
								</div>
							</div>
							<div className="space-y-2">
								<div className="h-3 w-16 animate-pulse rounded bg-muted" />
								<div className="flex gap-1.5">
									<div className="h-8 w-16 animate-pulse rounded-full bg-muted" />
									<div className="h-8 w-16 animate-pulse rounded-full bg-muted" />
								</div>
							</div>
						</div>
						<div className="shrink-0 border-t py-5 md:border-t-0 md:px-6 md:py-0">
							<div className="aspect-square w-full max-w-[280px] animate-pulse rounded-lg bg-muted md:h-[300px] md:w-[280px]" />
						</div>
						<div className="flex w-full flex-col border-t pt-5 md:min-w-[180px] md:border-t-0 md:border-l md:pl-6 md:pt-0">
							<div className="space-y-2">
								{Array.from({ length: 5 }).map((_, i) => (
									<div
										key={i}
										className="h-10 w-full animate-pulse rounded-lg bg-muted"
									/>
								))}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Step 2: Booking form
	if (step === "form" && selectedDate && selectedSlotObj) {
		if (isGroupMode && groupData && groupEventType) {
			return (
				<BookingForm
					host={{
						userId: groupData.host?.id ?? "",
						name: groupData.host?.name ?? "",
						image: groupData.host?.image ?? null,
						avatarUrl: groupData.host?.avatarUrl ?? null,
						bio: groupData.host?.bio ?? null,
					}}
					eventType={{
						id: groupEventType.id,
						title: groupEventType.title,
						durationMinutes: groupEventType.durationMinutes,
					}}
					slot={selectedSlotObj}
					date={selectedDate}
					timezone={timezone}
					onBack={handleBack}
					groupId={groupData.id}
					groupEventTypeId={groupEventType.id}
					groupData={{
						name: groupData.name,
						description: groupData.description,
						members: groupData.members,
					}}
				/>
			);
		}

		if (selectedPerson && selectedEventType) {
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
	}

	// Compute durations for group mode
	const groupDurations = groupData
		? [...new Set(groupData.eventTypes.map((et) => et.durationMinutes))].sort(
				(a, b) => a - b,
			)
		: [];

	// Step 1: Date & time picker
	return (
		<Card className="w-full max-w-5xl">
			<CardContent>
				<div className="flex flex-col md:h-[480px] md:flex-row">
					{/* Left: Person/Group, Info, Duration, Timezone */}
					<div className="w-full shrink-0 overflow-y-auto pb-5 md:w-[240px] md:border-r md:pb-0 md:pr-6">
						{isGroupMode && groupData ? (
							<PersonEventSelector
								people={[]}
								selectedUserId={null}
								selectedDuration={selectedDuration}
								selectedEventType={
									groupEventType
										? {
												id: groupEventType.id,
												title: groupEventType.title,
												slug: groupEventType.slug,
												durationMinutes: groupEventType.durationMinutes,
												description: groupEventType.description,
												color: groupEventType.color,
											}
										: null
								}
								onUserChange={handleUserChange}
								onDurationChange={handleDurationChange}
								timezone={timezone}
								onTimezoneChange={setTimezone}
								locked
								groupData={{
									name: groupData.name,
									description: groupData.description,
									host: groupData.host,
									members: groupData.members,
									durations: groupDurations,
								}}
							/>
						) : (
							<PersonEventSelector
								people={people}
								selectedUserId={selectedUserId}
								selectedDuration={selectedDuration}
								selectedEventType={selectedEventType}
								onUserChange={handleUserChange}
								onDurationChange={handleDurationChange}
								timezone={timezone}
								onTimezoneChange={setTimezone}
								locked={isLocked}
							/>
						)}
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
					<div className="flex w-full flex-col overflow-hidden border-t pt-5 md:min-h-0 md:min-w-[180px] md:border-t-0 md:border-l md:pl-6 md:pt-0">
						{selectedDate ? (
							<div className="flex max-h-[300px] flex-col md:max-h-none md:flex-1">
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
										{t.bookingCard.continue}
										<ArrowRight className="size-4" />
									</Button>
								)}
							</div>
						) : (
							<div className="flex h-full items-center justify-center py-6 md:py-0">
								<p className="text-center text-[13px] text-muted-foreground whitespace-pre-line">
									{t.bookingCard.selectDatePrompt}
								</p>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
