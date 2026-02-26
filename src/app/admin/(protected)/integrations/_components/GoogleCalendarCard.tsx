"use client";

import { Check, Loader2, Plus, Unlink } from "lucide-react";

import { GoogleCalendarIcon } from "@/components/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";
import { toast } from "sonner";

import { CalendarSelector } from "./CalendarSelector";
import { EventCalendarSelector } from "./EventCalendarSelector";

export function GoogleCalendarCard() {
	const status = api.googleCalendar.getStatus.useQuery();
	const authUrl = api.googleCalendar.getAuthUrl.useQuery();
	const utils = api.useUtils();
	const disconnect = api.googleCalendar.disconnect.useMutation({
		onSuccess: () => {
			status.refetch();
			utils.team.list.invalidate();
			utils.profile.setupStatus.invalidate();
			toast.success("Google Calendar disconnected");
		},
		onError: (err) => toast.error(err.message),
	});

	const isLoading = status.isLoading;
	const connected = status.data?.connected ?? false;
	const accounts = status.data?.accounts ?? [];

	function handleConnect() {
		if (authUrl.data?.url) {
			window.location.href = authUrl.data.url;
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
						<GoogleCalendarIcon className="size-5" />
					</div>
					<div>
						<CardTitle>Google Calendar</CardTitle>
						<CardDescription>
							Sync your availability and create events automatically.
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Checking connection...
					</div>
				) : connected ? (
					<div className="space-y-6">
						{/* Per-account sections: busy calendars */}
						{accounts.map((account) => (
							<div key={account.id} className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm">
										<Check className="size-4 text-green-600 dark:text-green-400" />
										<span className="font-medium">{account.accountEmail}</span>
										{account.isEventTarget && (
											<Badge variant="secondary" className="text-xs">
												event target
											</Badge>
										)}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => disconnect.mutate({ tokenId: account.id })}
										disabled={disconnect.isPending}
									>
										{disconnect.isPending ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Unlink className="size-4" />
										)}
										Disconnect
									</Button>
								</div>

								<CalendarSelector
								tokenId={account.id}
								eventCalendarId={account.isEventTarget ? account.calendarId : undefined}
							/>

								<Separator />
							</div>
						))}

						{/* Single event calendar selector across all accounts */}
						<EventCalendarSelector accounts={accounts} />

						<Separator />

						<Button
							variant="outline"
							onClick={handleConnect}
							disabled={!authUrl.data?.url}
						>
							<Plus className="size-4" />
							Add another Google account
						</Button>
					</div>
				) : (
					<Button
						onClick={handleConnect}
						disabled={!authUrl.data?.url}
					>
						<GoogleCalendarIcon className="size-4" />
						Connect Google Calendar
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
