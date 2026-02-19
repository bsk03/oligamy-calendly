"use client";

import { Globe } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoogleMeetIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const TIMEZONES = [
	"Europe/Warsaw",
	"Europe/London",
	"Europe/Berlin",
	"Europe/Paris",
	"Europe/Amsterdam",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Australia/Sydney",
	"UTC",
];

interface EventType {
	id: string;
	title: string;
	slug: string;
	durationMinutes: number;
	description: string | null;
	color: string | null;
}

interface Person {
	userId: string;
	name: string;
	image: string | null;
	bio: string | null;
	avatarUrl: string | null;
	eventTypes: EventType[];
}

interface PersonEventSelectorProps {
	people: Person[];
	selectedUserId: string | null;
	selectedDuration: number | null;
	selectedEventType: EventType | null;
	onUserChange: (userId: string) => void;
	onDurationChange: (duration: number) => void;
	timezone: string;
	onTimezoneChange: (tz: string) => void;
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function PersonEventSelector({
	people,
	selectedUserId,
	selectedDuration,
	selectedEventType,
	onUserChange,
	onDurationChange,
	timezone,
	onTimezoneChange,
}: PersonEventSelectorProps) {
	const selectedPerson = people.find((p) => p.userId === selectedUserId);

	const durations = [
		...new Set(
			(selectedPerson?.eventTypes ?? []).map((et) => et.durationMinutes),
		),
	].sort((a, b) => a - b);

	return (
		<div className="flex h-full flex-col gap-5">
			{/* Expert Selection — Avatar Row */}
			<div>
				<p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
					Select Expert
				</p>
				{people.length === 0 ? (
					<div className="flex gap-2.5 pb-1">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="size-10 shrink-0 animate-pulse rounded-full bg-gray-100"
							/>
						))}
					</div>
				) : (
					<div className="flex gap-2.5 overflow-x-auto p-1">
						{people.map((person) => (
							<button
								key={person.userId}
								type="button"
								onClick={() => onUserChange(person.userId)}
								className={cn(
									"shrink-0 rounded-full transition-all duration-200",
									selectedUserId === person.userId
										? "ring-2 ring-gray-900 ring-offset-2"
										: "opacity-40 hover:opacity-80",
								)}
							>
								<Avatar size="lg">
									<AvatarImage
										src={
											person.avatarUrl ??
											person.image ??
											undefined
										}
										alt={person.name}
									/>
									<AvatarFallback>
										{getInitials(person.name)}
									</AvatarFallback>
								</Avatar>
							</button>
						))}
					</div>
				)}
			</div>

			{/* Dynamic Info */}
			{selectedPerson && (
				<div className="space-y-0.5">
					<h3 className="text-[15px] font-semibold leading-tight">
						{selectedPerson.name}
					</h3>
					{selectedPerson.bio && (
						<p className="text-[13px] text-muted-foreground">
							{selectedPerson.bio}
						</p>
					)}
					{selectedEventType && (
						<div className="flex items-center gap-1.5 pt-1.5 text-[13px] text-muted-foreground">
							<GoogleMeetIcon className="size-3.5 shrink-0" />
							<span>{selectedEventType.title}</span>
						</div>
					)}
				</div>
			)}

			{/* Duration Selector */}
			{selectedPerson && durations.length > 0 && (
				<div>
					<p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
						Duration
					</p>
					<div className="flex flex-wrap gap-1.5">
						{durations.map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => onDurationChange(d)}
								className={cn(
									"rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
									selectedDuration === d
										? "bg-gray-900 text-white shadow-sm"
										: "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700",
								)}
							>
								{d} min
							</button>
						))}
					</div>
				</div>
			)}

			{/* No event types warning */}
			{selectedPerson && durations.length === 0 && (
				<p className="text-xs text-muted-foreground">
					This expert has no meeting types configured yet.
				</p>
			)}

			{/* Timezone */}
			<div className="mt-auto">
				<div className="flex items-center gap-1.5 text-muted-foreground">
					<Globe className="size-3.5 shrink-0" />
					<select
						value={timezone}
						onChange={(e) => onTimezoneChange(e.target.value)}
						className="cursor-pointer bg-transparent text-xs outline-none transition-colors hover:text-foreground"
					>
						{TIMEZONES.map((tz) => (
							<option key={tz} value={tz}>
								{tz.replace(/_/g, " ")}
							</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}
