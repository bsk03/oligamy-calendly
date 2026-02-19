"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const DAY_LABELS = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
] as const;

// Map display index (0=Mon) to DB dayOfWeek (0=Sun)
function displayToDb(displayIndex: number) {
	return displayIndex === 6 ? 0 : displayIndex + 1;
}
function dbToDisplay(dayOfWeek: number) {
	return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

type TimeRange = { startTime: string; endTime: string };
type DaySlot = {
	isAvailable: boolean;
	ranges: TimeRange[];
};

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number) as [number, number];
	return h * 60 + m;
}

function rangesOverlap(ranges: TimeRange[]): boolean {
	if (ranges.length < 2) return false;
	const sorted = ranges
		.map((r) => ({ start: timeToMinutes(r.startTime), end: timeToMinutes(r.endTime) }))
		.sort((a, b) => a.start - b.start);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i]!.start < sorted[i - 1]!.end) return true;
	}
	return false;
}

const DEFAULT_SCHEDULE: DaySlot[] = DAY_LABELS.map((_, i) => ({
	isAvailable: i < 5, // Mon-Fri on, Sat-Sun off
	ranges: [{ startTime: "09:00", endTime: "17:00" }],
}));

export function WeeklySchedule() {
	const [schedule, setSchedule] = useState<DaySlot[]>(DEFAULT_SCHEDULE);
	const [hasChanges, setHasChanges] = useState(false);
	const [isUnsaved, setIsUnsaved] = useState(false);

	const { data, isLoading } = api.availability.getWeekly.useQuery();
	const utils = api.useUtils();

	const save = api.availability.setWeekly.useMutation({
		onSuccess: () => {
			void utils.availability.getWeekly.invalidate();
			void utils.profile.setupStatus.invalidate();
			void utils.team.list.invalidate();
			setHasChanges(false);
			setIsUnsaved(false);
			toast.success("Schedule saved");
		},
		onError: (err) => toast.error(err.message),
	});

	useEffect(() => {
		if (!data) return;
		if (data.length === 0) {
			setIsUnsaved(true);
			return;
		}
		// Group rows by display index (dayOfWeek)
		const newSchedule: DaySlot[] = DAY_LABELS.map(() => ({
			isAvailable: false,
			ranges: [],
		}));

		for (const row of data) {
			const displayIdx = dbToDisplay(row.dayOfWeek);
			const slot = newSchedule[displayIdx]!;
			if (row.isAvailable) {
				slot.isAvailable = true;
				slot.ranges.push({
					startTime: row.startTime,
					endTime: row.endTime,
				});
			}
		}

		// For days with no rows or not available, set default range
		for (const slot of newSchedule) {
			if (slot.ranges.length === 0) {
				slot.ranges = [{ startTime: "09:00", endTime: "17:00" }];
			}
		}

		setSchedule(newSchedule);
		setIsUnsaved(false);
	}, [data]);

	function updateDay(index: number, partial: Partial<DaySlot>) {
		setSchedule((prev) => {
			const next = [...prev];
			next[index] = { ...next[index]!, ...partial };
			return next;
		});
		setHasChanges(true);
	}

	function updateRange(dayIndex: number, rangeIndex: number, partial: Partial<TimeRange>) {
		setSchedule((prev) => {
			const next = [...prev];
			const day = { ...next[dayIndex]! };
			const ranges = [...day.ranges];
			ranges[rangeIndex] = { ...ranges[rangeIndex]!, ...partial };
			day.ranges = ranges;
			next[dayIndex] = day;
			return next;
		});
		setHasChanges(true);
	}

	function addRange(dayIndex: number) {
		setSchedule((prev) => {
			const next = [...prev];
			const day = { ...next[dayIndex]! };
			day.ranges = [...day.ranges, { startTime: "09:00", endTime: "17:00" }];
			next[dayIndex] = day;
			return next;
		});
		setHasChanges(true);
	}

	function removeRange(dayIndex: number, rangeIndex: number) {
		setSchedule((prev) => {
			const next = [...prev];
			const day = { ...next[dayIndex]! };
			day.ranges = day.ranges.filter((_, i) => i !== rangeIndex);
			next[dayIndex] = day;
			return next;
		});
		setHasChanges(true);
	}

	function handleSave() {
		// Validate no overlapping ranges
		for (let i = 0; i < schedule.length; i++) {
			const slot = schedule[i]!;
			if (slot.isAvailable && rangesOverlap(slot.ranges)) {
				toast.error(`${DAY_LABELS[i]}: time ranges must not overlap.`);
				return;
			}
		}

		const items: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[] = [];
		for (let i = 0; i < schedule.length; i++) {
			const slot = schedule[i]!;
			const dayOfWeek = displayToDb(i);
			if (slot.isAvailable) {
				for (const range of slot.ranges) {
					items.push({
						dayOfWeek,
						startTime: range.startTime,
						endTime: range.endTime,
						isAvailable: true,
					});
				}
			} else {
				items.push({
					dayOfWeek,
					startTime: "09:00",
					endTime: "17:00",
					isAvailable: false,
				});
			}
		}
		save.mutate(items);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				{schedule.map((slot, i) => (
					<div
						key={DAY_LABELS[i]}
						className="rounded-lg border px-4 py-3"
					>
						<div className="flex items-start gap-4">
							<Switch
								className="mt-0.5"
								checked={slot.isAvailable}
								onCheckedChange={(checked) =>
									updateDay(i, { isAvailable: checked })
								}
							/>
							<Label className="mt-0.5 w-24 shrink-0 text-sm font-medium">
								{DAY_LABELS[i]}
							</Label>

							{slot.isAvailable ? (
								<div className="flex flex-1 flex-col gap-2">
									{slot.ranges.map((range, ri) => (
										<div key={ri} className="flex items-center gap-2">
											<Input
												type="time"
												value={range.startTime}
												onChange={(e) =>
													updateRange(i, ri, { startTime: e.target.value })
												}
												className="w-32"
											/>
											<span className="text-sm text-muted-foreground">—</span>
											<Input
												type="time"
												value={range.endTime}
												onChange={(e) =>
													updateRange(i, ri, { endTime: e.target.value })
												}
												className="w-32"
											/>
											{slot.ranges.length > 1 && (
												<Button
													variant="ghost"
													size="icon-sm"
													onClick={() => removeRange(i, ri)}
													type="button"
												>
													<X className="size-4 text-muted-foreground" />
												</Button>
											)}
										</div>
									))}
									<Button
										variant="ghost"
										size="sm"
										onClick={() => addRange(i)}
										type="button"
										className="w-fit text-xs text-muted-foreground"
									>
										<Plus className="size-3" />
										Add time range
									</Button>
									{rangesOverlap(slot.ranges) && (
										<p className="text-xs text-red-500">
											Time ranges overlap.
										</p>
									)}
								</div>
							) : (
								<span className="text-sm text-muted-foreground">Unavailable</span>
							)}
						</div>
					</div>
				))}
			</div>

			{isUnsaved && (
				<p className="text-sm text-amber-600">
					Schedule not saved yet. Click save to apply.
				</p>
			)}

			<Button onClick={handleSave} disabled={save.isPending || (!hasChanges && !isUnsaved)}>
				{save.isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Save className="size-4" />
				)}
				Save Schedule
			</Button>
		</div>
	);
}
