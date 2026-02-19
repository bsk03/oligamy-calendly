"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

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

type DaySlot = {
	startTime: string;
	endTime: string;
	isAvailable: boolean;
};

const DEFAULT_SCHEDULE: DaySlot[] = DAY_LABELS.map((_, i) => ({
	startTime: "09:00",
	endTime: "17:00",
	isAvailable: i < 5, // Mon-Fri on, Sat-Sun off
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
			// No data on backend — show defaults but allow saving
			setIsUnsaved(true);
			return;
		}
		const newSchedule = [...DEFAULT_SCHEDULE];
		for (const row of data) {
			const displayIdx = dbToDisplay(row.dayOfWeek);
			newSchedule[displayIdx] = {
				startTime: row.startTime,
				endTime: row.endTime,
				isAvailable: row.isAvailable,
			};
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

	function handleSave() {
		save.mutate(
			schedule.map((slot, displayIdx) => ({
				dayOfWeek: displayToDb(displayIdx),
				startTime: slot.startTime,
				endTime: slot.endTime,
				isAvailable: slot.isAvailable,
			})),
		);
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
						className="flex items-center gap-4 rounded-lg border px-4 py-3"
					>
						<Switch
							checked={slot.isAvailable}
							onCheckedChange={(checked) =>
								updateDay(i, { isAvailable: checked })
							}
						/>
						<Label className="w-24 shrink-0 text-sm font-medium">
							{DAY_LABELS[i]}
						</Label>

						{slot.isAvailable ? (
							<div className="flex items-center gap-2">
								<Input
									type="time"
									value={slot.startTime}
									onChange={(e) =>
										updateDay(i, { startTime: e.target.value })
									}
									className="w-32"
								/>
								<span className="text-sm text-muted-foreground">—</span>
								<Input
									type="time"
									value={slot.endTime}
									onChange={(e) =>
										updateDay(i, { endTime: e.target.value })
									}
									className="w-32"
								/>
							</div>
						) : (
							<span className="text-sm text-muted-foreground">Unavailable</span>
						)}
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
