"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
	CalendarOff,
	CalendarPlus,
	Loader2,
	Plus,
	Trash2,
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
			) : !overrides?.length ? (
				<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
					No date overrides set.
				</div>
			) : (
				<div className="space-y-2">
					{overrides.map((o) => (
						<div
							key={o.id}
							className="flex items-center justify-between rounded-lg border px-4 py-3"
						>
							<div className="flex items-center gap-3">
								{o.isAvailable ? (
									<CalendarPlus className="size-4 text-green-600" />
								) : (
									<CalendarOff className="size-4 text-red-500" />
								)}
								<div>
									<span className="text-sm font-medium">
										{format(new Date(`${o.date}T00:00:00`), "EEEE, d MMM yyyy")}
									</span>
									{o.isAvailable && o.startTime && o.endTime && (
										<span className="ml-2 text-sm text-muted-foreground">
											{o.startTime} — {o.endTime}
										</span>
									)}
									{o.reason && (
										<span className="ml-2 text-sm text-muted-foreground">
											({o.reason})
										</span>
									)}
								</div>
								<Badge variant={o.isAvailable ? "secondary" : "destructive"}>
									{o.isAvailable ? "Custom hours" : "Unavailable"}
								</Badge>
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => deleteOverride.mutate({ id: o.id })}
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

function CreateOverrideDialog() {
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>();
	const [isAvailable, setIsAvailable] = useState(false);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("17:00");
	const [reason, setReason] = useState("");

	const utils = api.useUtils();
	const create = api.availability.createOverride.useMutation({
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
		setStartTime("09:00");
		setEndTime("17:00");
		setReason("");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!date) return;

		create.mutate({
			date: format(date, "yyyy-MM-dd"),
			isAvailable,
			startTime: isAvailable ? startTime : null,
			endTime: isAvailable ? endTime : null,
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
							<div className="flex items-center gap-2">
								<div className="space-y-1">
									<Label className="text-xs">From</Label>
									<Input
										type="time"
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
										className="w-32"
									/>
								</div>
								<span className="mt-5 text-sm text-muted-foreground">—</span>
								<div className="space-y-1">
									<Label className="text-xs">To</Label>
									<Input
										type="time"
										value={endTime}
										onChange={(e) => setEndTime(e.target.value)}
										className="w-32"
									/>
								</div>
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
						<Button type="submit" disabled={create.isPending || !date}>
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
