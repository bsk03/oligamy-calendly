"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function CalendarSelector() {
	const {
		data,
		isLoading,
		isError,
		refetch,
	} = api.googleCalendar.listCalendars.useQuery();

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [eventCalendarId, setEventCalendarId] = useState<string>("");
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		if (data && !initialized) {
			setSelectedIds(new Set(data.selectedCalendarIds));
			setEventCalendarId(data.eventCalendarId ?? "");
			setInitialized(true);
		}
	}, [data, initialized]);

	const utils = api.useUtils();

	const updateBusyMutation = api.googleCalendar.updateSelectedCalendars.useMutation({
		onSuccess: () => {
			utils.googleCalendar.listCalendars.invalidate();
			toast.success("Busy calendars updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const updateEventMutation = api.googleCalendar.updateEventCalendar.useMutation({
		onSuccess: () => {
			utils.googleCalendar.listCalendars.invalidate();
			toast.success("Event calendar updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const hasBusyChanges =
		initialized &&
		data &&
		(selectedIds.size !== data.selectedCalendarIds.length ||
			[...selectedIds].some((id) => !(data.selectedCalendarIds as string[]).includes(id)));

	function toggleCalendar(calendarId: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(calendarId)) {
				if (next.size > 1) {
					next.delete(calendarId);
				}
			} else {
				next.add(calendarId);
			}
			return next;
		});
	}

	function handleSaveBusy() {
		updateBusyMutation.mutate({ calendarIds: [...selectedIds] });
	}

	function handleEventCalendarChange(calendarId: string) {
		setEventCalendarId(calendarId);
		updateEventMutation.mutate({ calendarId });
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="flex items-center gap-3">
						<Skeleton className="size-4 rounded" />
						<Skeleton className="h-4 w-40" />
					</div>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span>Failed to load calendars.</span>
				<Button variant="ghost" size="sm" onClick={() => refetch()}>
					<RefreshCw className="size-3.5" />
					Retry
				</Button>
			</div>
		);
	}

	if (!data || data.calendars.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">No calendars found.</p>
		);
	}

	// Only calendars with write access can be used for event creation
	const writableCalendars = data.calendars.filter(
		(c) => c.accessRole === "owner" || c.accessRole === "writer",
	);

	return (
		<div className="space-y-5">
			{/* Busy calendars */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium">
					Calendars to check for conflicts
				</h4>
				<p className="text-xs text-muted-foreground">
					Selected calendars will be checked for busy times when
					generating available slots.
				</p>
				<div className="space-y-2 pt-1">
					{data.calendars.map((cal) => (
						<label
							key={cal.id}
							className="flex cursor-pointer items-center gap-3"
						>
							<Checkbox
								checked={selectedIds.has(cal.id)}
								onCheckedChange={() => toggleCalendar(cal.id)}
							/>
							<span
								className="size-3 rounded-full shrink-0"
								style={{ backgroundColor: cal.backgroundColor }}
							/>
							<span className="text-sm">
								{cal.summary}
								{cal.primary && (
									<span className="ml-1.5 text-xs text-muted-foreground">
										(primary)
									</span>
								)}
							</span>
						</label>
					))}

					{hasBusyChanges && (
						<Button
							size="sm"
							onClick={handleSaveBusy}
							disabled={updateBusyMutation.isPending}
						>
							{updateBusyMutation.isPending && (
								<Loader2 className="size-4 animate-spin" />
							)}
							Save
						</Button>
					)}
				</div>
			</div>

			<Separator />

			{/* Event calendar */}
			<div className="space-y-2">
				<h4 className="text-sm font-medium">
					Calendar for new events
				</h4>
				<p className="text-xs text-muted-foreground">
					New bookings will create events in this calendar.
				</p>
				<Select
					value={eventCalendarId}
					onValueChange={handleEventCalendarChange}
					disabled={updateEventMutation.isPending}
				>
					<SelectTrigger className="w-full max-w-xs">
						<SelectValue placeholder="Select calendar" />
					</SelectTrigger>
					<SelectContent>
						{writableCalendars.map((cal) => (
							<SelectItem key={cal.id} value={cal.id}>
								<span
									className="inline-block size-2.5 rounded-full shrink-0"
									style={{ backgroundColor: cal.backgroundColor }}
								/>
								{cal.summary}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
