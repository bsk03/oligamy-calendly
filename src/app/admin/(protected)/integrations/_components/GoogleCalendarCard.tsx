"use client";

import { Check, Loader2, Unlink } from "lucide-react";

import { GoogleCalendarIcon } from "@/components/icons";

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

export function GoogleCalendarCard() {
	const status = api.googleCalendar.getStatus.useQuery();
	const authUrl = api.googleCalendar.getAuthUrl.useQuery(undefined, {
		enabled: status.data?.connected === false,
	});
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
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
								<Check className="size-4" />
								Connected
								{status.data?.calendarId && (
									<span className="text-muted-foreground">
										({status.data.calendarId})
									</span>
								)}
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => disconnect.mutate()}
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

						<Separator />

						<CalendarSelector />
					</div>
				) : (
					<Button
						onClick={() => {
							if (authUrl.data?.url) {
								window.location.href = authUrl.data.url;
							}
						}}
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
