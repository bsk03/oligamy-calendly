"use client";

import { useState } from "react";
import {
	Calendar,
	Check,
	Clock,
	ExternalLink,
	Loader2,
	Mail,
	RefreshCw,
	User,
	Video,
	X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { BookingStatus } from "@/server/db/schema";
import { api } from "@/trpc/react";

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
	[BookingStatus.PENDING]: { label: "Pending", variant: "secondary" },
	[BookingStatus.CONFIRMED]: { label: "Confirmed", variant: "default" },
	[BookingStatus.CANCELLED]: { label: "Declined", variant: "destructive" },
	[BookingStatus.COMPLETED]: { label: "Completed", variant: "outline" },
};

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function formatTime(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
}

function isUpcoming(date: Date) {
	return date > new Date();
}

export function SyncStatusesButton() {
	const utils = api.useUtils();

	const syncMutation = api.booking.syncFromCalendar.useMutation({
		onSuccess: (data) => {
			if (data.synced > 0) {
				toast.success(`Synced ${data.synced} booking(s)`);
				void utils.booking.list.invalidate();
				void utils.booking.stats.invalidate();
			} else {
				toast.info("All statuses up to date");
			}
		},
		onError: (err) => toast.error(err.message),
	});

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-1.5"
			disabled={syncMutation.isPending}
			onClick={() => syncMutation.mutate()}
		>
			<RefreshCw className={cn("size-3.5", syncMutation.isPending && "animate-spin")} />
			Sync statuses
		</Button>
	);
}

export function BookingsList({ isAdmin }: { isAdmin: boolean }) {
	const [selectedHostId, setSelectedHostId] = useState<string>("all");

	const { data: hosts } = api.booking.hosts.useQuery(undefined, {
		enabled: isAdmin,
	});

	const { data: bookings, isLoading } = api.booking.list.useQuery(
		isAdmin && selectedHostId !== "all"
			? { hostId: selectedHostId }
			: undefined,
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	const upcoming = bookings?.filter(
		(b) => isUpcoming(b.startTime) && b.status !== BookingStatus.CANCELLED,
	) ?? [];
	const past = bookings?.filter(
		(b) => !isUpcoming(b.startTime) || b.status === BookingStatus.CANCELLED,
	) ?? [];

	return (
		<div className="space-y-6">
			{/* Admin: host filter */}
			{isAdmin && hosts && hosts.length > 0 && (
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">Filter by host:</span>
					<Select value={selectedHostId} onValueChange={setSelectedHostId}>
						<SelectTrigger className="w-[220px]">
							<SelectValue placeholder="All members" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All members</SelectItem>
							{hosts.map((h) => (
								<SelectItem key={h.id} value={h.id}>
									{h.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{/* Upcoming */}
			<Section
				title="Upcoming"
				bookings={upcoming}
				isAdmin={isAdmin}
				emptyText="No upcoming bookings."
			/>

			{/* Past */}
			{past.length > 0 && (
				<Section
					title="Past"
					bookings={past}
					isAdmin={isAdmin}
					emptyText=""
				/>
			)}

			{!bookings?.length && (
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					No bookings yet.
				</div>
			)}
		</div>
	);
}

function Section({
	title,
	bookings,
	isAdmin,
	emptyText,
}: {
	title: string;
	bookings: NonNullable<ReturnType<typeof api.booking.list.useQuery>["data"]>;
	isAdmin: boolean;
	emptyText: string;
}) {
	if (bookings.length === 0 && !emptyText) return null;

	return (
		<div>
			<h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
				{title} ({bookings.length})
			</h2>
			{bookings.length === 0 ? (
				<p className="text-sm text-muted-foreground">{emptyText}</p>
			) : (
				<div className="grid gap-2">
					{bookings.map((b) => (
						<BookingCard key={b.id} booking={b} isAdmin={isAdmin} />
					))}
				</div>
			)}
		</div>
	);
}

function BookingCard({
	booking: b,
	isAdmin,
}: {
	booking: NonNullable<ReturnType<typeof api.booking.list.useQuery>["data"]>[number];
	isAdmin: boolean;
}) {
	const utils = api.useUtils();
	const statusStyle = STATUS_STYLES[b.status] ?? STATUS_STYLES.PENDING!;
	const upcoming = isUpcoming(b.startTime);
	const canConfirm = upcoming && b.status !== BookingStatus.CONFIRMED;
	const canCancel = upcoming && b.status !== BookingStatus.CANCELLED;

	const confirmMutation = api.booking.confirm.useMutation({
		onSuccess: () => {
			toast.success("Booking confirmed");
			void utils.booking.list.invalidate();
			void utils.booking.stats.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const cancelMutation = api.booking.cancel.useMutation({
		onSuccess: () => {
			toast.success("Booking cancelled");
			void utils.booking.list.invalidate();
			void utils.booking.stats.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const isBusy = confirmMutation.isPending || cancelMutation.isPending;

	return (
		<Card className="py-3">
			<CardHeader className="pb-0">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<CardTitle className="text-sm font-medium truncate">
							{b.eventTypeTitle}
						</CardTitle>
						<Badge variant={statusStyle.variant} className="text-[10px] shrink-0">
							{statusStyle.label}
						</Badge>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						{b.meetLink && (
							<a
								href={b.meetLink}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
							>
								<Video className="size-3" />
								Meet
								<ExternalLink className="size-2.5" />
							</a>
						)}
						{canConfirm && (
							<Button
								size="sm"
								variant="outline"
								className="h-7 gap-1 text-xs"
								disabled={isBusy}
								onClick={() => confirmMutation.mutate({ bookingId: b.id })}
							>
								<Check className="size-3" />
								Confirm
							</Button>
						)}
						{canCancel && (
							<Button
								size="sm"
								variant="ghost"
								className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
								disabled={isBusy}
								onClick={() => cancelMutation.mutate({ bookingId: b.id })}
							>
								<X className="size-3" />
								Decline
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-2">
				<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
					<div className="flex items-center gap-1.5">
						<Calendar className="size-3" />
						{formatDate(b.startTime)}
					</div>
					<div className="flex items-center gap-1.5">
						<Clock className="size-3" />
						{formatTime(b.startTime)} – {formatTime(b.endTime)}
					</div>
					<div className="flex items-center gap-1.5">
						<User className="size-3" />
						{b.guestName}
					</div>
					<div className="flex items-center gap-1.5">
						<Mail className="size-3" />
						{b.guestEmail}
					</div>
					{isAdmin && (
						<div className="flex items-center gap-1.5 font-medium text-foreground">
							Host: {b.hostName}
						</div>
					)}
				</div>
				{b.guestNotes && (
					<p className="mt-2 text-xs text-muted-foreground italic">
						&ldquo;{b.guestNotes}&rdquo;
					</p>
				)}
			</CardContent>
		</Card>
	);
}
