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
	const utils = api.useUtils();

	const updateEventMutation = api.googleCalendar.updateEventCalendar.useMutation({
		onSuccess: () => {
			utils.googleCalendar.getStatus.invalidate();
			utils.googleCalendar.listCalendars.invalidate();
			toast.success("Event calendar updated");
		},
		onError: (err) => toast.error(err.message),
	});

	// Collect selected (busy) calendar IDs across all accounts
	const calendarQueries = accounts.map((account) =>
		// eslint-disable-next-line react-hooks/rules-of-hooks
		api.googleCalendar.listCalendars.useQuery({ tokenId: account.id }),
	);

	const selectedCalendarIdsByToken = useMemo(() => {
		const map = new Map<string, Set<string>>();
		accounts.forEach((account, i) => {
			const data = calendarQueries[i]?.data;
			if (data) {
				map.set(account.id, new Set(data.selectedCalendarIds as string[]));
			}
		});
		return map;
	}, [accounts, calendarQueries]);

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

	if (accounts.length === 0) return null;

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
					{accounts.map((account) => (
						<AccountCalendarGroup
							key={account.id}
							account={account}
							showLabel={accounts.length > 1}
							selectedBusyIds={selectedCalendarIdsByToken.get(account.id)}
						/>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function AccountCalendarGroup({
	account,
	showLabel,
	selectedBusyIds,
}: {
	account: Account;
	showLabel: boolean;
	selectedBusyIds: Set<string> | undefined;
}) {
	const { data, isLoading } = api.googleCalendar.listCalendars.useQuery({
		tokenId: account.id,
	});

	if (isLoading) {
		return (
			<SelectGroup>
				<SelectLabel className="text-muted-foreground">Loading...</SelectLabel>
			</SelectGroup>
		);
	}

	const calendars = (data?.calendars ?? []).filter(
		(c) =>
			(c.accessRole === "owner" || c.accessRole === "writer") &&
			(selectedBusyIds ? selectedBusyIds.has(c.id) : true),
	);

	if (calendars.length === 0) return null;

	return (
		<SelectGroup>
			{showLabel && <SelectLabel>{account.accountEmail}</SelectLabel>}
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
	);
}
