"use client";

import Link from "next/link";
import {
	ArrowRight,
	Calendar,
	CalendarDays,
	CheckCircle2,
	Clock,
	ExternalLink,
	LinkIcon,
	ListChecks,
	Loader2,
	Settings,
	Users,
	Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";

function formatTime(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
}

function isToday(date: Date) {
	const now = new Date();
	return (
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate()
	);
}

const SETUP_STEPS = [
	{
		key: "hasProfile" as const,
		label: "Configure profile",
		description: "Set your bio and make yourself visible on the booking page",
		href: "/admin/settings",
		icon: Settings,
	},
	{
		key: "hasAvailability" as const,
		label: "Set availability",
		description: "Define your weekly working hours",
		href: "/admin/availability",
		icon: Clock,
	},
	{
		key: "hasEventTypes" as const,
		label: "Create event type",
		description: "Add at least one meeting type people can book",
		href: "/admin/event-types",
		icon: ListChecks,
	},
	{
		key: "hasGoogleCalendar" as const,
		label: "Connect Google Calendar",
		description: "Sync bookings and check busy times automatically",
		href: "/admin/integrations",
		icon: LinkIcon,
	},
];

export function DashboardContent({
	isAdmin,
	userName,
}: {
	isAdmin: boolean;
	userName: string;
}) {
	const { data: stats, isLoading: statsLoading } =
		api.booking.stats.useQuery();
	const { data: setup, isLoading: setupLoading } =
		api.profile.setupStatus.useQuery();

	if (statsLoading || setupLoading) {
		return (
			<div className="flex items-center justify-center py-16 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	const completedSteps = setup
		? SETUP_STEPS.filter((s) => setup[s.key]).length
		: 0;
	const allDone = completedSteps === SETUP_STEPS.length;

	return (
		<div className="space-y-6">
			{/* Greeting */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Welcome back, {userName.split(" ")[0]}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{isAdmin
						? "Here\u2019s an overview of your team\u2019s bookings."
						: "Here\u2019s what\u2019s coming up."}
				</p>
			</div>

			{/* Stat cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Today"
					value={stats?.todayCount ?? 0}
					subtitle="bookings"
					icon={<Calendar className="size-4 text-muted-foreground" />}
				/>
				<StatCard
					title="This week"
					value={stats?.thisWeekCount ?? 0}
					subtitle="bookings"
					icon={<CalendarDays className="size-4 text-muted-foreground" />}
				/>
				<StatCard
					title="Upcoming"
					value={stats?.upcomingCount ?? 0}
					subtitle="total"
					icon={<Clock className="size-4 text-muted-foreground" />}
				/>
				{isAdmin ? (
					<StatCard
						title="Team"
						value={stats?.totalMembers ?? 0}
						subtitle="members"
						icon={<Users className="size-4 text-muted-foreground" />}
					/>
				) : (
					<StatCard
						title="Setup"
						value={`${completedSteps}/${SETUP_STEPS.length}`}
						subtitle={allDone ? "complete" : "steps done"}
						icon={<CheckCircle2 className="size-4 text-muted-foreground" />}
					/>
				)}
			</div>

			{/* Admin extra: total bookings card */}
			{isAdmin && (
				<Card>
					<CardContent className="flex items-center justify-between py-3">
						<div className="flex items-center gap-3 text-sm">
							<CalendarDays className="size-4 text-muted-foreground" />
							<span className="text-muted-foreground">
								Total bookings all time:
							</span>
							<span className="font-semibold">
								{stats?.totalBookingsAllTime ?? 0}
							</span>
						</div>
						<Button variant="ghost" size="sm" asChild>
							<Link href="/admin/bookings">
								View all
								<ArrowRight className="size-3.5" />
							</Link>
						</Button>
					</CardContent>
				</Card>
			)}

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Upcoming bookings */}
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="text-base">Upcoming bookings</CardTitle>
							<Button variant="ghost" size="sm" asChild>
								<Link href="/admin/bookings">
									View all
									<ArrowRight className="size-3.5" />
								</Link>
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{!stats?.upcoming?.length ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No upcoming bookings.
							</p>
						) : (
							<div className="space-y-3">
								{stats.upcoming.map((b) => (
									<div
										key={b.id}
										className="flex items-start gap-3 rounded-lg border p-3"
									>
										{/* Date badge */}
										<div className="flex flex-col items-center justify-center rounded-md bg-muted px-2.5 py-1.5 text-center">
											<span className="text-[10px] font-medium uppercase text-muted-foreground leading-none">
												{new Intl.DateTimeFormat("en-US", {
													month: "short",
												}).format(b.startTime)}
											</span>
											<span className="text-lg font-bold leading-tight">
												{b.startTime.getDate()}
											</span>
										</div>

										{/* Details */}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium truncate">
													{b.eventTypeTitle}
												</span>
												{isToday(b.startTime) && (
													<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
														Today
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground">
												{formatTime(b.startTime)} – {formatTime(b.endTime)} with {b.guestName}
											</p>
											{isAdmin && (
												<p className="text-xs text-muted-foreground">
													Host: {b.hostName}
												</p>
											)}
										</div>

										{/* Meet link */}
										{b.meetLink && (
											<a
												href={b.meetLink}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-blue-600 hover:bg-muted shrink-0"
											>
												<Video className="size-3" />
												Join
											</a>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Setup checklist */}
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="text-base">Setup checklist</CardTitle>
							{allDone && (
								<Badge variant="secondary" className="gap-1">
									<CheckCircle2 className="size-3" />
									All done
								</Badge>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{SETUP_STEPS.map((step) => {
								const done = setup?.[step.key] ?? false;
								const Icon = step.icon;
								return (
									<Link
										key={step.key}
										href={step.href}
										className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted ${
											done ? "opacity-60" : ""
										}`}
									>
										<div
											className={`flex size-8 items-center justify-center rounded-full ${
												done
													? "bg-emerald-50 text-emerald-600"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{done ? (
												<CheckCircle2 className="size-4" />
											) : (
												<Icon className="size-4" />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<p
												className={`text-sm font-medium ${
													done ? "line-through" : ""
												}`}
											>
												{step.label}
											</p>
											<p className="text-xs text-muted-foreground">
												{step.description}
											</p>
										</div>
										{!done && (
											<ArrowRight className="size-4 text-muted-foreground shrink-0" />
										)}
									</Link>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Admin: quick links */}
			{isAdmin && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Quick actions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" asChild>
								<Link href="/admin/team">
									<Users className="size-3.5" />
									Manage team
								</Link>
							</Button>
							<Button variant="outline" size="sm" asChild>
								<Link href="/admin/bookings">
									<CalendarDays className="size-3.5" />
									All bookings
								</Link>
							</Button>
							<Button variant="outline" size="sm" asChild>
								<Link href="/" target="_blank">
									<ExternalLink className="size-3.5" />
									Booking page
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function StatCard({
	title,
	value,
	subtitle,
	icon,
}: {
	title: string;
	value: number | string;
	subtitle: string;
	icon: React.ReactNode;
}) {
	return (
		<Card>
			<CardContent className="py-4">
				<div className="flex items-center justify-between">
					<p className="text-xs font-medium text-muted-foreground">{title}</p>
					{icon}
				</div>
				<div className="mt-1">
					<span className="text-2xl font-bold">{value}</span>
					<span className="ml-1.5 text-xs text-muted-foreground">{subtitle}</span>
				</div>
			</CardContent>
		</Card>
	);
}
