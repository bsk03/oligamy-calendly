"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

interface TimeSlot {
	start: string;
	end: string;
}

interface TimeSlotListProps {
	slots: TimeSlot[];
	selectedSlot: string | null;
	isLoading: boolean;
	onSlotSelect: (slot: TimeSlot) => void;
	dateString: string;
	timeFormat: "12h" | "24h";
	onTimeFormatChange: (format: "12h" | "24h") => void;
	timezone: string;
}

function formatTime(isoString: string, is24h: boolean, timezone: string, intlLocale: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString(intlLocale, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: !is24h,
		timeZone: timezone,
	});
}

function formatDateHeader(dateString: string, intlLocale: string): string {
	const [y, m, d] = dateString.split("-").map(Number) as [
		number,
		number,
		number,
	];
	const date = new Date(y, m - 1, d);
	return new Intl.DateTimeFormat(intlLocale, {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(date);
}

export function TimeSlotList({
	slots,
	selectedSlot,
	isLoading,
	onSlotSelect,
	dateString,
	timeFormat,
	onTimeFormatChange,
	timezone,
}: TimeSlotListProps) {
	const { t, intlLocale } = useTranslation();
	const is24h = timeFormat === "24h";

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-6 w-16" />
				</div>
				<div className="flex flex-col gap-1.5">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-10 w-full rounded-lg" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-3">
			{/* Header: formatted date + 12h/24h toggle */}
			<div className="flex shrink-0 items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">
					{formatDateHeader(dateString, intlLocale)}
				</h3>
				<div className="flex overflow-hidden rounded-md border text-[11px] font-medium">
					<button
						type="button"
						onClick={() => onTimeFormatChange("24h")}
						className={cn(
							"px-2 py-1 transition-colors",
							is24h
								? "bg-gray-900 text-white"
								: "text-gray-500 hover:bg-gray-50",
						)}
					>
						24h
					</button>
					<button
						type="button"
						onClick={() => onTimeFormatChange("12h")}
						className={cn(
							"px-2 py-1 transition-colors",
							!is24h
								? "bg-gray-900 text-white"
								: "text-gray-500 hover:bg-gray-50",
						)}
					>
						12h
					</button>
				</div>
			</div>

			{/* Slot list */}
			{slots.length === 0 ? (
				<div className="flex flex-1 items-center justify-center">
					<p className="text-[13px] text-muted-foreground">
						{t.timeSlotList.noAvailableTimes}
					</p>
				</div>
			) : (
				<ScrollArea className="min-h-0 flex-1">
					<div className="flex flex-col gap-1.5 pr-3">
						{slots.map((slot) => {
							const isSelected = selectedSlot === slot.start;
							return (
								<button
									key={slot.start}
									type="button"
									onClick={() => onSlotSelect(slot)}
									className={cn(
										"flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-all duration-150",
										isSelected
											? "border-gray-900 bg-gray-900 font-semibold text-white shadow-sm"
											: "border-gray-200 hover:bg-gray-50",
									)}
								>
									<span
										className={cn(
											"size-2 shrink-0 rounded-full",
											isSelected
												? "bg-white"
												: "bg-emerald-400",
										)}
									/>
									{formatTime(slot.start, is24h, timezone, intlLocale)}
								</button>
							);
						})}
					</div>
				</ScrollArea>
			)}
		</div>
	);
}
