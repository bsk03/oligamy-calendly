"use client";

import { useState } from "react";
import { AlertCircle, Clock, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const DURATION_PRESETS = [
	{ label: "15 min", value: 15 },
	{ label: "30 min", value: 30 },
	{ label: "45 min", value: 45 },
	{ label: "1 h", value: 60 },
] as const;

export function CreateEventTypeDialog() {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [duration, setDuration] = useState<number>(30);
	const [customDuration, setCustomDuration] = useState("");
	const [isCustom, setIsCustom] = useState(false);
	const [minimumNoticeHours, setMinimumNoticeHours] = useState("2");

	const utils = api.useUtils();
	const create = api.eventType.create.useMutation({
		onSuccess: () => {
			utils.eventType.list.invalidate();
			utils.team.list.invalidate();
			utils.profile.setupStatus.invalidate();
			setOpen(false);
			resetForm();
			toast.success("Event type created");
		},
		onError: (err) => toast.error(err.message),
	});

	function resetForm() {
		setTitle("");
		setDuration(30);
		setCustomDuration("");
		setIsCustom(false);
		setMinimumNoticeHours("2");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const finalDuration = isCustom ? Number(customDuration) : duration;
		if (!title.trim() || !finalDuration || finalDuration < 5) return;

		create.mutate({
			title: title.trim(),
			durationMinutes: finalDuration,
			minimumNoticeHours: Number(minimumNoticeHours) || 2,
		});
	}

	return (
		<Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="size-4" />
					New Event Type
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>New Event Type</DialogTitle>
						<DialogDescription>
							Create a new type of meeting that people can book with you.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="title">Name</Label>
							<Input
								id="title"
								placeholder="e.g. Quick chat, Consultation..."
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								autoFocus
							/>
						</div>

						<div className="space-y-2">
							<Label>Duration</Label>
							<div className="flex flex-wrap gap-2">
								{DURATION_PRESETS.map((preset) => (
									<Button
										key={preset.value}
										type="button"
										variant={!isCustom && duration === preset.value ? "default" : "outline"}
										size="sm"
										onClick={() => {
											setDuration(preset.value);
											setIsCustom(false);
										}}
									>
										<Clock className="size-3.5" />
										{preset.label}
									</Button>
								))}
								<Button
									type="button"
									variant={isCustom ? "default" : "outline"}
									size="sm"
									onClick={() => setIsCustom(true)}
								>
									Custom
								</Button>
							</div>

							{isCustom && (
								<div className="flex items-center gap-2 pt-1">
									<Input
										type="number"
										min={5}
										max={480}
										placeholder="Minutes"
										value={customDuration}
										onChange={(e) => setCustomDuration(e.target.value)}
										className="w-28"
									/>
									<span className="text-sm text-muted-foreground">minutes</span>
								</div>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="minimum-notice">
								<AlertCircle className="mr-1 inline size-3.5" />
								Minimum notice
							</Label>
							<div className="flex items-center gap-2">
								<Input
									id="minimum-notice"
									type="number"
									min={0}
									max={168}
									value={minimumNoticeHours}
									onChange={(e) => setMinimumNoticeHours(e.target.value)}
									className="w-28"
								/>
								<span className="text-sm text-muted-foreground">hours before</span>
							</div>
							<p className="text-xs text-muted-foreground">
								How far in advance must someone book? E.g. 2h means slots less than 2h from now won&apos;t be available.
							</p>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<Button
							type="submit"
							disabled={
								create.isPending ||
								!title.trim() ||
								(isCustom && (!customDuration || Number(customDuration) < 5))
							}
						>
							{create.isPending && <Loader2 className="size-4 animate-spin" />}
							Create
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
