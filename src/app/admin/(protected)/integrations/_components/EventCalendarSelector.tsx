"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface Account {
	id: string;
	accountEmail: string;
	calendarId: string;
	isEventTarget: boolean;
}

interface EventCalendarSelectorProps {
	accounts: Account[];
}

export function EventCalendarSelector({ accounts }: EventCalendarSelectorProps) {
	// Fetch calendars for each account
	const calendarQueries = accounts.map((account) =>
		// eslint-disable-next-line react-hooks/rules-of-hooks
		api.googleCalendar.listCalendars.useQuery({ tokenId: account.id }),
	);

	const utils = api.useUtils();

	const updateEventMutation = api.googleCalendar.updateEventCalendar.useMutation({
		onSuccess: () => {
			utils.googleCalendar.getStatus.invalidate();
			utils.googleCalendar.listCalendars.invalidate();
			toast.success("Event calendar updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const isLoading = calendarQueries.some((q) => q.isLoading);

	// Build grouped list of writable calendars across all accounts
	const groups = useMemo(() => {
		return accounts.map((account, i) => {
			const data = calendarQueries[i]?.data;
			const calendars = (data?.calendars ?? []).filter(
				(c) => c.accessRole === "owner" || c.accessRole === "writer",
			);
			return { account, calendars };
		}).filter((g) => g.calendars.length > 0);
	}, [accounts, calendarQueries]);

	// Compute current value: "tokenId:calendarId"
	const currentValue = useMemo(() => {
		const eventTarget = accounts.find((a) => a.isEventTarget);
		if (!eventTarget) return "";
		return `${eventTarget.id}:${eventTarget.calendarId}`;
	}, [accounts]);

	function handleChange(value: string) {
		const sepIdx = value.indexOf(":");
		if (sepIdx === -1) return;
		const tokenId = value.substring(0, sepIdx);
		const calendarId = value.substring(sepIdx + 1);
		updateEventMutation.mutate({ tokenId, calendarId });
	}

	if (isLoading) {
		return (
			<div className="space-y-2">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-9 w-64" />
			</div>
		);
	}

	if (groups.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">Calendar for new events</h4>
			<p className="text-xs text-muted-foreground">
				New bookings will create events in the selected calendar.
			</p>
			<Select
				value={currentValue}
				onValueChange={handleChange}
				disabled={updateEventMutation.isPending}
			>
				<SelectTrigger className="w-full max-w-sm">
					{updateEventMutation.isPending ? (
						<div className="flex items-center gap-2">
							<Loader2 className="size-4 animate-spin" />
							<span>Updating...</span>
						</div>
					) : (
						<SelectValue placeholder="Select calendar" />
					)}
				</SelectTrigger>
				<SelectContent>
					{groups.map(({ account, calendars }) => (
						<SelectGroup key={account.id}>
							{accounts.length > 1 && (
								<SelectLabel>{account.accountEmail}</SelectLabel>
							)}
							{calendars.map((cal) => (
								<SelectItem
									key={`${account.id}:${cal.id}`}
									value={`${account.id}:${cal.id}`}
								>
									<span
										className="inline-block size-2.5 rounded-full shrink-0"
										style={{ backgroundColor: cal.backgroundColor }}
									/>
									{cal.summary}
								</SelectItem>
							))}
						</SelectGroup>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
