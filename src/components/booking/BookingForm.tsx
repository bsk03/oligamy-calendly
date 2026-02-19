"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
	ArrowLeft,
	Calendar,
	CheckCircle2,
	Clock,
	Loader2,
	User,
	Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GoogleMeetIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const guestFormSchema = z.object({
	guestName: z.string().min(1, "Name is required").max(200),
	guestEmail: z.email("Invalid email address"),
	guestNotes: z.string().max(1000).optional(),
});

type GuestFormValues = z.infer<typeof guestFormSchema>;

interface BookingFormProps {
	host: {
		userId: string;
		name: string;
		image: string | null;
		avatarUrl: string | null;
		bio: string | null;
	};
	eventType: {
		id: string;
		title: string;
		durationMinutes: number;
	};
	slot: {
		start: string;
		end: string;
	};
	date: string;
	timezone: string;
	onBack: () => void;
	groupId?: string;
	groupEventTypeId?: string;
	groupData?: {
		name: string;
		description: string | null;
		members: {
			userId: string;
			name: string;
			image: string | null;
			avatarUrl: string | null;
		}[];
	};
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function formatDate(dateStr: string): string {
	const [y, m, d] = dateStr.split("-").map(Number) as [
		number,
		number,
		number,
	];
	const date = new Date(y, m - 1, d);
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function formatTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

export function BookingForm({
	host,
	eventType,
	slot,
	date,
	timezone,
	onBack,
	groupId,
	groupEventTypeId,
	groupData,
}: BookingFormProps) {
	const isGroupBooking = !!groupEventTypeId;

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<GuestFormValues>({
		resolver: zodResolver(guestFormSchema),
		defaultValues: {
			guestName: "",
			guestEmail: "",
			guestNotes: "",
		},
	});

	const guestEmail = watch("guestEmail");

	const createBooking = api.booking.create.useMutation({
		onSuccess: () => {
			toast.success("Booking confirmed!");
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	const onSubmit = (data: GuestFormValues) => {
		if (isGroupBooking) {
			createBooking.mutate({
				groupId: groupId,
				groupEventTypeId: groupEventTypeId,
				startTime: slot.start,
				endTime: slot.end,
				timezone,
				guestName: data.guestName,
				guestEmail: data.guestEmail,
				guestNotes: data.guestNotes || undefined,
			});
		} else {
			createBooking.mutate({
				hostId: host.userId,
				eventTypeId: eventType.id,
				startTime: slot.start,
				endTime: slot.end,
				timezone,
				guestName: data.guestName,
				guestEmail: data.guestEmail,
				guestNotes: data.guestNotes || undefined,
			});
		}
	};

	if (createBooking.isSuccess) {
		return (
			<Card className="w-full max-w-2xl">
				<CardContent>
					<div className="flex flex-col items-center gap-4 py-8 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
							<CheckCircle2 className="size-7 text-emerald-600" />
						</div>
						<div>
							<h2 className="text-lg font-semibold">
								Booking confirmed
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{isGroupBooking && groupData
									? `Your meeting with ${groupData.name} has been scheduled.`
									: `Your meeting with ${host.name} has been scheduled.`}
							</p>
						</div>
						<div className="mt-2 rounded-lg border px-6 py-4 text-left text-sm">
							<div className="flex items-center gap-2">
								<Calendar className="size-4 text-muted-foreground" />
								<span>{formatDate(date)}</span>
							</div>
							<div className="mt-1.5 flex items-center gap-2">
								<Clock className="size-4 text-muted-foreground" />
								<span>
									{formatTime(slot.start)} –{" "}
									{formatTime(slot.end)}
								</span>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							A confirmation has been sent to {guestEmail}
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-2xl">
			<CardContent>
				<div className="flex flex-col md:flex-row">
					{/* Left: Summary */}
					<div className="w-full shrink-0 pb-5 md:w-[240px] md:border-r md:pb-0 md:pr-6">
						<button
							type="button"
							onClick={onBack}
							className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowLeft className="size-3.5" />
							Back
						</button>

						<div className="flex flex-col gap-4">
							{/* Group info */}
							{isGroupBooking && groupData ? (
								<>
									<div className="flex items-center gap-2">
										<div className="flex size-8 items-center justify-center rounded-lg bg-gray-100">
											<Users className="size-4 text-gray-600" />
										</div>
										<div>
											<p className="text-sm font-semibold leading-tight">
												{groupData.name}
											</p>
										</div>
									</div>

									{/* Host */}
									<div className="flex items-center gap-2">
										<Avatar size="sm">
											<AvatarImage
												src={
													host.avatarUrl ??
													host.image ??
													undefined
												}
												alt={host.name}
											/>
											<AvatarFallback>
												{getInitials(host.name)}
											</AvatarFallback>
										</Avatar>
										<span className="text-xs text-muted-foreground">
											Host: {host.name}
										</span>
									</div>

									{/* Members */}
									{groupData.members.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{groupData.members.map((m) => (
												<div
													key={m.userId}
													className="flex items-center gap-1 rounded-full bg-gray-50 py-0.5 pr-2 pl-0.5"
												>
													<Avatar size="sm">
														<AvatarImage
															src={
																m.avatarUrl ??
																m.image ??
																undefined
															}
															alt={m.name}
														/>
														<AvatarFallback className="text-[8px]">
															{getInitials(m.name)}
														</AvatarFallback>
													</Avatar>
													<span className="text-[10px] text-gray-500">
														{m.name}
													</span>
												</div>
											))}
										</div>
									)}
								</>
							) : (
								/* Host (individual mode) */
								<div className="flex items-center gap-3">
									<Avatar>
										<AvatarImage
											src={
												host.avatarUrl ??
												host.image ??
												undefined
											}
											alt={host.name}
										/>
										<AvatarFallback>
											{getInitials(host.name)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="text-sm font-semibold leading-tight">
											{host.name}
										</p>
										{host.bio && (
											<p className="text-xs text-muted-foreground">
												{host.bio}
											</p>
										)}
									</div>
								</div>
							)}

							{/* Meeting type */}
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<GoogleMeetIcon className="size-3.5 shrink-0" />
								<span>{eventType.title}</span>
							</div>

							{/* Date */}
							<div className="flex items-center gap-2 text-sm">
								<Calendar className="size-3.5 shrink-0 text-muted-foreground" />
								<span>{formatDate(date)}</span>
							</div>

							{/* Time */}
							<div className="flex items-center gap-2 text-sm">
								<Clock className="size-3.5 shrink-0 text-muted-foreground" />
								<span>
									{formatTime(slot.start)} –{" "}
									{formatTime(slot.end)}
								</span>
								<span className="text-muted-foreground">
									({eventType.durationMinutes} min)
								</span>
							</div>
						</div>
					</div>

					{/* Right: Form */}
					<div className="min-w-0 flex-1 border-t pt-5 md:border-t-0 md:pl-6 md:pt-0">
						<h2 className="mb-4 text-base font-semibold">
							Your details
						</h2>

						<form
							onSubmit={handleSubmit(onSubmit)}
							className="flex flex-col gap-4"
						>
							<div className="grid gap-2">
								<Label htmlFor="guest-name">
									<User className="mr-1 inline size-3.5" />
									Your name
								</Label>
								<Input
									id="guest-name"
									placeholder="John Doe"
									{...register("guestName")}
								/>
								{errors.guestName && (
									<p className="text-xs text-destructive">
										{errors.guestName.message}
									</p>
								)}
							</div>

							<div className="grid gap-2">
								<Label htmlFor="guest-email">
									Email address
								</Label>
								<Input
									id="guest-email"
									type="email"
									placeholder="john@example.com"
									{...register("guestEmail")}
								/>
								{errors.guestEmail && (
									<p className="text-xs text-destructive">
										{errors.guestEmail.message}
									</p>
								)}
							</div>

							<div className="grid gap-2">
								<Label htmlFor="guest-notes">
									Additional notes
								</Label>
								<Textarea
									id="guest-notes"
									placeholder="Anything the host should know..."
									rows={3}
									{...register("guestNotes")}
								/>
								{errors.guestNotes && (
									<p className="text-xs text-destructive">
										{errors.guestNotes.message}
									</p>
								)}
							</div>

							{createBooking.isError && (
								<p className="text-sm text-destructive">
									{createBooking.error.message}
								</p>
							)}

							<Button
								type="submit"
								disabled={createBooking.isPending}
								className="mt-2"
							>
								{createBooking.isPending && (
									<Loader2 className="size-4 animate-spin" />
								)}
								Confirm booking
							</Button>
						</form>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
