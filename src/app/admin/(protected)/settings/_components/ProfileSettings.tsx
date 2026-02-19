"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle2, Globe, Link, Loader2, User, XCircle } from "lucide-react";

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

	const [username, setUsername] = useState("");
	const [bio, setBio] = useState("");
	const [timezone, setTimezone] = useState("Europe/Warsaw");
	const [isVisibleOnHome, setIsVisibleOnHome] = useState(false);
	const [bookingWindowMode, setBookingWindowMode] = useState<"relative" | "absolute">("relative");
	const [bookingWindowDays, setBookingWindowDays] = useState(30);
	const [bookingWindowEndDate, setBookingWindowEndDate] = useState("");
	const [defaultLocale, setDefaultLocale] = useState<"en" | "pl">("en");

	useEffect(() => {
		if (profileData) {
			setUsername(profileData.username ?? "");
			setBio(profileData.bio ?? "");
			setTimezone(profileData.timezone);
			setIsVisibleOnHome(profileData.isVisibleOnHome);
			setBookingWindowMode(
				(profileData.bookingWindowMode as "relative" | "absolute") ?? "relative",
			);
			setBookingWindowDays(profileData.bookingWindowDays ?? 30);
			setBookingWindowEndDate(profileData.bookingWindowEndDate ?? "");
			setDefaultLocale((profileData.defaultLocale as "en" | "pl") ?? "en");
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
			username: username || null,
			bio: bio || undefined,
			timezone,
			isVisibleOnHome,
			bookingWindowMode,
			bookingWindowDays,
			bookingWindowEndDate: bookingWindowMode === "absolute" ? (bookingWindowEndDate || null) : null,
			defaultLocale,
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
		((username || "") !== (profileData.username ?? "") ||
			(bio || "") !== (profileData.bio ?? "") ||
			timezone !== profileData.timezone ||
			isVisibleOnHome !== profileData.isVisibleOnHome ||
			bookingWindowMode !== ((profileData.bookingWindowMode as string) ?? "relative") ||
			bookingWindowDays !== (profileData.bookingWindowDays ?? 30) ||
			bookingWindowEndDate !== (profileData.bookingWindowEndDate ?? "") ||
			defaultLocale !== ((profileData.defaultLocale as string) ?? "en"));

	return (
		<div className="grid gap-6">
			{/* Username / Personal URL */}
			<UsernameCard
				username={username}
				savedUsername={profileData?.username ?? ""}
				onUsernameChange={setUsername}
			/>

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

					<div className="grid gap-2">
						<Label htmlFor="defaultLocale">Default booking language</Label>
						<select
							id="defaultLocale"
							value={defaultLocale}
							onChange={(e) => setDefaultLocale(e.target.value as "en" | "pl")}
							className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						>
							<option value="en">English</option>
							<option value="pl">Polski</option>
						</select>
						<p className="text-xs text-muted-foreground">
							The default language guests see on your booking page. They can switch manually.
						</p>
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

const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function useDebounce<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}

function UsernameCard({
	username,
	savedUsername,
	onUsernameChange,
}: {
	username: string;
	savedUsername: string;
	onUsernameChange: (v: string) => void;
}) {
	const debouncedUsername = useDebounce(username, 400);

	const isValidFormat = username.length >= 3 && USERNAME_REGEX.test(username);
	const isUnchanged = username === savedUsername && username !== "";

	const { data: checkResult, isFetching: isChecking } =
		api.profile.checkUsername.useQuery(
			{ username: debouncedUsername },
			{
				enabled: isValidFormat && !isUnchanged && debouncedUsername === username,
			},
		);

	const baseDomain = useMemo(() => {
		if (typeof window === "undefined") return "localhost:3000";
		const host = window.location.host;
		// Strip any existing subdomain for preview (e.g., "app.book-cal.com" → "book-cal.com")
		// For localhost, keep as-is
		return host;
	}, []);

	const previewUrl = username ? `${username}.${baseDomain}` : null;

	let validationStatus: "idle" | "invalid" | "checking" | "taken" | "available" | "saved" = "idle";
	if (username === "") {
		validationStatus = "idle";
	} else if (username.length < 3) {
		validationStatus = "invalid";
	} else if (!isValidFormat) {
		validationStatus = "invalid";
	} else if (isUnchanged) {
		validationStatus = "saved";
	} else if (isChecking || debouncedUsername !== username) {
		validationStatus = "checking";
	} else if (checkResult?.available === false) {
		validationStatus = "taken";
	} else if (checkResult?.available === true) {
		validationStatus = "available";
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Link className="size-4" />
					Personal URL
				</CardTitle>
				<CardDescription>
					Your unique booking subdomain. Guests will visit this
					address to schedule meetings with you.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-2">
					<Label htmlFor="username">Username</Label>
					<div className="flex items-center">
						<Input
							id="username"
							placeholder="e.g. kowalczyk"
							value={username}
							onChange={(e) =>
								onUsernameChange(
									e.target.value
										.toLowerCase()
										.replace(/[^a-z0-9-]/g, ""),
								)
							}
							className="rounded-r-none"
						/>
						<span className="flex h-9 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground whitespace-nowrap">
							.{baseDomain}
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						Only lowercase letters, numbers, and hyphens. Min 3
						characters.
					</p>
				</div>

				{/* Validation feedback */}
				{validationStatus === "invalid" && (
					<div className="flex items-center gap-1.5 text-xs text-destructive">
						<XCircle className="size-3.5" />
						{username.length < 3
							? "Username must be at least 3 characters."
							: "Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number."}
					</div>
				)}
				{validationStatus === "checking" && (
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Loader2 className="size-3.5 animate-spin" />
						Checking availability...
					</div>
				)}
				{validationStatus === "taken" && (
					<div className="flex items-center gap-1.5 text-xs text-destructive">
						<XCircle className="size-3.5" />
						This username is already taken.
					</div>
				)}
				{validationStatus === "available" && (
					<div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
						<CheckCircle2 className="size-3.5" />
						Username is available!
					</div>
				)}
				{validationStatus === "saved" && (
					<div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
						<CheckCircle2 className="size-3.5" />
						This is your current username.
					</div>
				)}

				{/* Link preview */}
				{previewUrl && validationStatus !== "invalid" && (
					<div className="rounded-md border bg-muted/50 px-3 py-2">
						<p className="text-xs text-muted-foreground mb-1">
							Your booking link will be:
						</p>
						<p className="text-sm font-medium font-mono">
							{previewUrl}
						</p>
						{process.env.NODE_ENV === "development" && (
							<div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
								<AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
								<span>
									Development mode — subdomain routing requires
									DNS / hosts file configuration (e.g.{" "}
									<code className="rounded bg-muted px-1 font-mono">
										127.0.0.1 {previewUrl.split(":")[0]}
									</code>
									) or use{" "}
									<code className="rounded bg-muted px-1 font-mono">
										{username}.lvh.me:3000
									</code>{" "}
									which resolves to 127.0.0.1 automatically.
								</span>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
