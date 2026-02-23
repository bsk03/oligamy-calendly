"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimezoneCombobox } from "@/components/TimezoneCombobox";
import { api } from "@/trpc/react";
import { toast } from "sonner";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

interface CreateGroupDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({
	open,
	onOpenChange,
}: CreateGroupDialogProps) {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
	const [description, setDescription] = useState("");
	const [hostUserId, setHostUserId] = useState("");
	const [timezone, setTimezone] = useState("Europe/Warsaw");
	const [bookingWindowMode, setBookingWindowMode] = useState<"relative" | "absolute">("relative");
	const [bookingWindowDays, setBookingWindowDays] = useState(30);
	const [bookingWindowEndDate, setBookingWindowEndDate] = useState("");

	const { data: teamMembers } = api.team.list.useQuery();
	const utils = api.useUtils();

	const createGroup = api.group.create.useMutation({
		onSuccess: () => {
			toast.success("Group created");
			void utils.group.list.invalidate();
			onOpenChange(false);
			resetForm();
		},
		onError: (err) => toast.error(err.message),
	});

	function resetForm() {
		setName("");
		setSlug("");
		setSlugManuallyEdited(false);
		setDescription("");
		setHostUserId("");
		setTimezone("Europe/Warsaw");
		setBookingWindowMode("relative");
		setBookingWindowDays(30);
		setBookingWindowEndDate("");
	}

	useEffect(() => {
		if (!slugManuallyEdited) {
			setSlug(slugify(name));
		}
	}, [name, slugManuallyEdited]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || !slug.trim() || !hostUserId) return;

		createGroup.mutate({
			name: name.trim(),
			slug: slug.trim(),
			description: description.trim() || undefined,
			hostUserId,
			timezone,
			bookingWindowMode,
			bookingWindowDays: bookingWindowMode === "relative" ? bookingWindowDays : undefined,
			bookingWindowEndDate: bookingWindowMode === "absolute" && bookingWindowEndDate ? bookingWindowEndDate : null,
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Group</DialogTitle>
					<DialogDescription>
						Create a booking group with a shared calendar. The
						group&apos;s slug becomes its booking URL.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="grid gap-4 py-2">
					<div className="grid gap-2">
						<Label htmlFor="group-name">Name</Label>
						<Input
							id="group-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Sales Team"
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="group-slug">Slug (URL)</Label>
						<Input
							id="group-slug"
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value);
								setSlugManuallyEdited(true);
							}}
							placeholder="e.g. sales"
						/>
						{slug && (
							<p className="text-xs text-muted-foreground">
								URL: /book/{slug}
							</p>
						)}
					</div>

					<div className="grid gap-2">
						<Label htmlFor="group-description">
							Description (optional)
						</Label>
						<Textarea
							id="group-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief description of this group..."
							rows={2}
						/>
					</div>

					<div className="grid gap-2">
						<Label>Host</Label>
						<Select value={hostUserId} onValueChange={setHostUserId}>
							<SelectTrigger>
								<SelectValue placeholder="Select host..." />
							</SelectTrigger>
							<SelectContent>
								{teamMembers?.map((m) => (
									<SelectItem key={m.id} value={m.id}>
										{m.name} ({m.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							The host&apos;s calendar and availability schedule are used
							for booking.
						</p>
					</div>

					<div className="grid gap-2">
						<Label>Timezone</Label>
						<TimezoneCombobox value={timezone} onChange={setTimezone} />
					</div>

					<div className="grid gap-2">
						<Label>Booking Window</Label>
						<Select
							value={bookingWindowMode}
							onValueChange={(v) => setBookingWindowMode(v as "relative" | "absolute")}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="relative">Relative (days from now)</SelectItem>
								<SelectItem value="absolute">Absolute (end date)</SelectItem>
							</SelectContent>
						</Select>
						{bookingWindowMode === "relative" ? (
							<div className="flex items-center gap-2">
								<Input
									type="number"
									min={1}
									max={365}
									value={bookingWindowDays}
									onChange={(e) => setBookingWindowDays(Number(e.target.value))}
									className="w-24"
								/>
								<span className="text-sm text-muted-foreground">days</span>
							</div>
						) : (
							<Input
								type="date"
								value={bookingWindowEndDate}
								onChange={(e) => setBookingWindowEndDate(e.target.value)}
							/>
						)}
					</div>

					<DialogFooter>
						<Button
							type="submit"
							disabled={
								createGroup.isPending ||
								!name.trim() ||
								!slug.trim() ||
								!hostUserId
							}
						>
							{createGroup.isPending && (
								<Loader2 className="size-4 animate-spin" />
							)}
							Create
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
