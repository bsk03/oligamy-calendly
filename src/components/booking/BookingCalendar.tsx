"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

interface BookingCalendarProps {
	currentMonth: Date;
	availableDates: Set<string>;
	selectedDate: string | null;
	isLoading: boolean;
	onDateSelect: (date: string) => void;
	onMonthChange: (date: Date) => void;
}

export function BookingCalendar({
	currentMonth,
	availableDates,
	selectedDate,
	isLoading,
	onDateSelect,
	onMonthChange,
}: BookingCalendarProps) {
	const { t, intlLocale } = useTranslation();
	const year = currentMonth.getFullYear();
	const month = currentMonth.getMonth();

	const daysInMonth = new Date(year, month + 1, 0).getDate();

	// Sun=0 based (matches DAY_LABELS order)
	const firstDay = new Date(year, month, 1).getDay();

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

	const isPrevDisabled =
		year < today.getFullYear() ||
		(year === today.getFullYear() && month <= today.getMonth());

	const monthLabel = new Intl.DateTimeFormat(intlLocale, {
		month: "long",
	}).format(currentMonth);

	// Build grid cells
	const cells: (number | null)[] = [];
	for (let i = 0; i < firstDay; i++) cells.push(null);
	for (let day = 1; day <= daysInMonth; day++) cells.push(day);
	while (cells.length % 7 !== 0) cells.push(null);

	return (
		<div className="flex w-full flex-col md:w-auto">
			{/* Month navigation */}
			<div className="mb-5 flex items-center justify-between">
				<h2 className="text-lg tracking-tight">
					<span className="font-semibold">{monthLabel}</span>{" "}
					<span className="text-muted-foreground">{year}</span>
				</h2>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onMonthChange(new Date(year, month - 1, 1))}
						disabled={isPrevDisabled}
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronLeft className="size-4" />
					</button>
					<button
						type="button"
						onClick={() => onMonthChange(new Date(year, month + 1, 1))}
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
					>
						<ChevronRight className="size-4" />
					</button>
				</div>
			</div>

			{/* Day headers */}
			<div className="mb-1 grid grid-cols-7 gap-x-1">
				{t.bookingCalendar.dayLabels.map((label, i) => (
					<div
						key={i}
						className="flex h-8 items-center justify-center text-[11px] font-semibold tracking-wider text-muted-foreground"
					>
						{label}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div className="grid grid-cols-7 gap-1">
				{cells.map((day, idx) => {
					if (day === null) {
						return <div key={`empty-${idx}`} className="aspect-square w-full md:h-[52px] md:w-[52px]" />;
					}

					const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
					const isAvailable = availableDates.has(dateStr);
					const isSelected = selectedDate === dateStr;
					const isToday = dateStr === todayStr;

					return (
						<button
							key={dateStr}
							type="button"
							disabled={!isAvailable || isLoading}
							onClick={() => onDateSelect(dateStr)}
							className={cn(
								"relative flex aspect-square w-full flex-col items-center justify-center rounded-lg text-sm transition-all duration-150 md:h-[52px] md:w-[52px]",
								isSelected &&
									"bg-gray-900 font-semibold text-white shadow-sm",
								!isSelected &&
									isAvailable &&
									"cursor-pointer bg-gray-100 font-medium text-gray-900 hover:bg-gray-200",
								!isAvailable &&
									!isSelected &&
									"cursor-default text-gray-300",
							)}
						>
							{day}
							{isToday && (
								<span
									className={cn(
										"absolute bottom-1.5 size-1 rounded-full md:bottom-2",
										isSelected ? "bg-white" : "bg-gray-900",
									)}
								/>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
