"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
	CalendarOff,
	CalendarPlus,
	Loader2,
	Plus,
	Trash2,
	X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";
import { toast } from "sonner";

type OverrideRow = {
	id: string;
	date: string;
	isAvailable: boolean;
	startTime: string | null;
	endTime: string | null;
	reason: string | null;
};

type GroupedOverride = {
	date: string;
	isAvailable: boolean;
	ranges: { startTime: string; endTime: string }[];
	reason: string | null;
};

function groupOverridesByDate(overrides: OverrideRow[]): GroupedOverride[] {
	const map = new Map<string, GroupedOverride>();
	for (const o of overrides) {
		const existing = map.get(o.date);
		if (existing) {
			if (o.isAvailable && o.startTime && o.endTime) {
				existing.ranges.push({ startTime: o.startTime, endTime: o.endTime });
			}
			if (o.reason && !existing.reason) {
				existing.reason = o.reason;
			}
		} else {
			map.set(o.date, {
				date: o.date,
				isAvailable: o.isAvailable,
				ranges:
					o.isAvailable && o.startTime && o.endTime
						? [{ startTime: o.startTime, endTime: o.endTime }]
						: [],
				reason: o.reason,
			});
		}
	}
	return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function OverridesList() {
	const { data: overrides, isLoading } =
		api.availability.getOverrides.useQuery();
	const utils = api.useUtils();

	const deleteOverride = api.availability.deleteOverride.useMutation({
		onSuccess: () => {
			utils.availability.getOverrides.invalidate();
			toast.success("Override deleted");
		},
		onError: (err) => toast.error(err.message),
	});

	const grouped = overrides ? groupOverridesByDate(overrides) : [];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold">Date Overrides</h2>
					<p className="text-sm text-muted-foreground">
						Set custom hours or mark specific dates as unavailable.
					</p>
				</div>
				<CreateOverrideDialog />
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-8 text-muted-foreground">
					<Loader2 className="size-5 animate-spin" />
				</div>
			) : grouped.length === 0 ? (
				<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
					No date overrides set.
				</div>
			) : (
				<div className="space-y-2">
					{grouped.map((g) => (
						<div
							key={g.date}
							className="flex items-center justify-between rounded-lg border px-4 py-3"
						>
							<div className="flex items-center gap-3">
								{g.isAvailable ? (
									<CalendarPlus className="size-4 text-green-600" />
								) : (
									<CalendarOff className="size-4 text-red-500" />
								)}
								<div>
									<span className="text-sm font-medium">
										{format(new Date(`${g.date}T00:00:00`), "EEEE, d MMM yyyy")}
									</span>
									{g.isAvailable && g.ranges.length > 0 && (
										<span className="ml-2 text-sm text-muted-foreground">
											{g.ranges
												.map((r) => `${r.startTime} — ${r.endTime}`)
												.join(", ")}
										</span>
									)}
									{g.reason && (
										<span className="ml-2 text-sm text-muted-foreground">
											({g.reason})
										</span>
									)}
								</div>
								<Badge variant={g.isAvailable ? "secondary" : "destructive"}>
									{g.isAvailable ? "Custom hours" : "Unavailable"}
								</Badge>
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => deleteOverride.mutate({ date: g.date })}
								disabled={deleteOverride.isPending}
							>
								{deleteOverride.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Trash2 className="size-4 text-muted-foreground" />
								)}
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

type TimeRange = { startTime: string; endTime: string };

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

function CreateOverrideDialog() {
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>();
	const [isAvailable, setIsAvailable] = useState(false);
	const [ranges, setRanges] = useState<TimeRange[]>([
		{ startTime: "09:00", endTime: "17:00" },
	]);
	const [reason, setReason] = useState("");

	const utils = api.useUtils();
	const create = api.availability.setOverride.useMutation({
		onSuccess: () => {
			utils.availability.getOverrides.invalidate();
			setOpen(false);
			resetForm();
			toast.success("Override added");
		},
		onError: (err) => toast.error(err.message),
	});

	function resetForm() {
		setDate(undefined);
		setIsAvailable(false);
		setRanges([{ startTime: "09:00", endTime: "17:00" }]);
		setReason("");
	}

	function updateRange(index: number, partial: Partial<TimeRange>) {
		setRanges((prev) => {
			const next = [...prev];
			next[index] = { ...next[index]!, ...partial };
			return next;
		});
	}

	function addRange() {
		setRanges((prev) => [...prev, { startTime: "09:00", endTime: "17:00" }]);
	}

	function removeRange(index: number) {
		setRanges((prev) => prev.filter((_, i) => i !== index));
	}

	const hasOverlap = isAvailable && rangesOverlap(ranges);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!date) return;
		if (hasOverlap) {
			toast.error("Time ranges must not overlap.");
			return;
		}

		create.mutate({
			date: format(date, "yyyy-MM-dd"),
			isAvailable,
			ranges: isAvailable ? ranges : [],
			reason: reason.trim() || null,
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) resetForm();
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Plus className="size-4" />
					Add Override
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add Date Override</DialogTitle>
						<DialogDescription>
							Set custom availability or mark a day as unavailable.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label>Date</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="outline" className="w-full justify-start font-normal">
										{date
											? format(date, "EEEE, d MMM yyyy")
											: "Select a date..."}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={date}
										onSelect={setDate}
										disabled={{ before: new Date() }}
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="flex items-center gap-3">
							<Switch
								checked={isAvailable}
								onCheckedChange={setIsAvailable}
							/>
							<Label>
								{isAvailable
									? "Available with custom hours"
									: "Unavailable (day off)"}
							</Label>
						</div>

						{isAvailable && (
							<div className="space-y-2">
								{ranges.map((range, i) => (
									<div key={i} className="flex items-center gap-2">
										<div className="space-y-1">
											<Label className="text-xs">From</Label>
											<Input
												type="time"
												value={range.startTime}
												onChange={(e) =>
													updateRange(i, { startTime: e.target.value })
												}
												className="w-32"
											/>
										</div>
										<span className="mt-5 text-sm text-muted-foreground">—</span>
										<div className="space-y-1">
											<Label className="text-xs">To</Label>
											<Input
												type="time"
												value={range.endTime}
												onChange={(e) =>
													updateRange(i, { endTime: e.target.value })
												}
												className="w-32"
											/>
										</div>
										{ranges.length > 1 && (
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => removeRange(i)}
												type="button"
												className="mt-5"
											>
												<X className="size-4 text-muted-foreground" />
											</Button>
										)}
									</div>
								))}
								<Button
									variant="ghost"
									size="sm"
									onClick={addRange}
									type="button"
									className="text-xs text-muted-foreground"
								>
									<Plus className="size-3" />
									Add time range
								</Button>
								{hasOverlap && (
									<p className="text-xs text-red-500">
										Time ranges overlap.
									</p>
								)}
							</div>
						)}

						<div className="space-y-2">
							<Label>Reason (optional)</Label>
							<Input
								placeholder="e.g. Holiday, Doctor appointment..."
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<Button type="submit" disabled={create.isPending || !date || hasOverlap}>
							{create.isPending && (
								<Loader2 className="size-4 animate-spin" />
							)}
							Save Override
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
