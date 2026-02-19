"use client";

import { useEffect, useState } from "react";
import { Calendar, Globe, Loader2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { toast } from "sonner";

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

export function ProfileSettings() {
	const { data: profileData, isLoading } = api.profile.get.useQuery();
	const utils = api.useUtils();

	const [bio, setBio] = useState("");
	const [timezone, setTimezone] = useState("Europe/Warsaw");
	const [isVisibleOnHome, setIsVisibleOnHome] = useState(false);
	const [bookingWindowMode, setBookingWindowMode] = useState<"relative" | "absolute">("relative");
	const [bookingWindowDays, setBookingWindowDays] = useState(30);
	const [bookingWindowEndDate, setBookingWindowEndDate] = useState("");

	useEffect(() => {
		if (profileData) {
			setBio(profileData.bio ?? "");
			setTimezone(profileData.timezone);
			setIsVisibleOnHome(profileData.isVisibleOnHome);
			setBookingWindowMode(
				(profileData.bookingWindowMode as "relative" | "absolute") ?? "relative",
			);
			setBookingWindowDays(profileData.bookingWindowDays ?? 30);
			setBookingWindowEndDate(profileData.bookingWindowEndDate ?? "");
		}
	}, [profileData]);

	const updateProfile = api.profile.update.useMutation({
		onSuccess: () => {
			void utils.profile.get.invalidate();
			void utils.profile.setupStatus.invalidate();
			void utils.user.list.invalidate();
			void utils.team.list.invalidate();
			toast.success("Profile saved");
		},
		onError: () => {
			toast.error("Failed to save. Please try again.");
		},
	});

	const handleSave = () => {
		updateProfile.mutate({
			bio: bio || undefined,
			timezone,
			isVisibleOnHome,
			bookingWindowMode,
			bookingWindowDays,
			bookingWindowEndDate: bookingWindowMode === "absolute" ? (bookingWindowEndDate || null) : null,
		});
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	const hasChanges =
		profileData &&
		((bio || "") !== (profileData.bio ?? "") ||
			timezone !== profileData.timezone ||
			isVisibleOnHome !== profileData.isVisibleOnHome ||
			bookingWindowMode !== ((profileData.bookingWindowMode as string) ?? "relative") ||
			bookingWindowDays !== (profileData.bookingWindowDays ?? 30) ||
			bookingWindowEndDate !== (profileData.bookingWindowEndDate ?? ""));

	return (
		<div className="grid gap-6">
			{/* Profile Info */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<User className="size-4" />
						Profile
					</CardTitle>
					<CardDescription>
						Your public profile information visible on the booking
						page.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="bio">Role / Bio <span className="text-red-500">*</span></Label>
						<Textarea
							id="bio"
							placeholder="e.g. Sales Manager, Frontend Developer..."
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							rows={2}
						/>
						<p className="text-xs text-muted-foreground">
							Short description shown below your name on the
							booking page.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Preferences */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="size-4" />
						Preferences
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-5">
					<div className="grid gap-2">
						<Label htmlFor="timezone">Timezone</Label>
						<select
							id="timezone"
							value={timezone}
							onChange={(e) => setTimezone(e.target.value)}
							className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						>
							{TIMEZONES.map((tz) => (
								<option key={tz} value={tz}>
									{tz.replace(/_/g, " ")}
								</option>
							))}
						</select>
					</div>

					<div className="flex items-center justify-between rounded-lg border p-4">
						<div className="space-y-0.5">
							<Label>Visible on booking page</Label>
							<p className="text-xs text-muted-foreground">
								When enabled, you appear on the home page and
								guests can book meetings with you.
							</p>
						</div>
						<Switch
							checked={isVisibleOnHome}
							onCheckedChange={setIsVisibleOnHome}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Booking Window */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="size-4" />
						Booking window
					</CardTitle>
					<CardDescription>
						How far into the future guests can book meetings with
						you.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label>Mode</Label>
						<select
							value={bookingWindowMode}
							onChange={(e) =>
								setBookingWindowMode(
									e.target.value as "relative" | "absolute",
								)
							}
							className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						>
							<option value="relative">
								Relative (number of days from today)
							</option>
							<option value="absolute">
								Absolute (until a specific date)
							</option>
						</select>
					</div>

					{bookingWindowMode === "relative" ? (
						<div className="grid gap-2">
							<Label htmlFor="bookingWindowDays">
								Days ahead
							</Label>
							<Input
								id="bookingWindowDays"
								type="number"
								min={1}
								max={365}
								value={bookingWindowDays}
								onChange={(e) =>
									setBookingWindowDays(
										Math.max(
											1,
											Math.min(
												365,
												Number(e.target.value) || 1,
											),
										),
									)
								}
							/>
							<p className="text-xs text-muted-foreground">
								Guests can book up to {bookingWindowDays} days
								from today.
							</p>
						</div>
					) : (
						<div className="grid gap-2">
							<Label htmlFor="bookingWindowEndDate">
								Accept bookings until
							</Label>
							<Input
								id="bookingWindowEndDate"
								type="date"
								value={bookingWindowEndDate}
								min={
									new Date().toISOString().split("T")[0]
								}
								onChange={(e) =>
									setBookingWindowEndDate(e.target.value)
								}
							/>
							<p className="text-xs text-muted-foreground">
								Guests can book meetings up to and including
								this date.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Save */}
			<Button
				onClick={handleSave}
				disabled={
					updateProfile.isPending || !hasChanges
				}
			>
				{updateProfile.isPending && (
					<Loader2 className="size-4 animate-spin" />
				)}
				Save changes
			</Button>
		</div>
	);
}
