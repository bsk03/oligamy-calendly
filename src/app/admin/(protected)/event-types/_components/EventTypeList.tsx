"use client";

import { useState } from "react";
import { AlertCircle, Check, Clock, Loader2, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";
import { toast } from "sonner";

function formatDuration(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

function formatNotice(hours: number) {
	if (hours === 0) return "No minimum";
	if (hours < 1) return `${hours * 60} min`;
	if (hours === 1) return "1 hour";
	if (hours < 24) return `${hours} hours`;
	const days = Math.floor(hours / 24);
	const rem = hours % 24;
	if (rem === 0) return days === 1 ? "1 day" : `${days} days`;
	return `${days}d ${rem}h`;
}

export function EventTypeList() {
	const { data: eventTypes, isLoading } = api.eventType.list.useQuery();
	const utils = api.useUtils();
	const [editingNotice, setEditingNotice] = useState<string | null>(null);
	const [noticeValue, setNoticeValue] = useState("");

	const toggleActive = api.eventType.toggleActive.useMutation({
		onSuccess: () => {
			utils.eventType.list.invalidate();
			utils.team.list.invalidate();
			utils.profile.setupStatus.invalidate();
			toast.success("Event type updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const deleteEventType = api.eventType.delete.useMutation({
		onSuccess: () => {
			utils.eventType.list.invalidate();
			utils.team.list.invalidate();
			utils.profile.setupStatus.invalidate();
			toast.success("Event type deleted");
		},
		onError: (err) => toast.error(err.message),
	});

	const updateEventType = api.eventType.update.useMutation({
		onSuccess: () => {
			utils.eventType.list.invalidate();
			setEditingNotice(null);
			toast.success("Notice period updated");
		},
		onError: (err) => toast.error(err.message),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	if (!eventTypes?.length) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
				No event types yet. Create your first one to get started.
			</div>
		);
	}

	return (
		<div className="grid gap-3">
			{eventTypes.map((et) => (
				<Card key={et.id} className="py-4">
					<CardHeader className="pb-0">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div
									className="size-3 rounded-full"
									style={{ backgroundColor: et.color ?? "#3B82F6" }}
								/>
								<CardTitle className="text-base">{et.title}</CardTitle>
								<Badge variant={et.isActive ? "secondary" : "outline"}>
									{et.isActive ? "Active" : "Inactive"}
								</Badge>
							</div>
							<div className="flex items-center gap-2">
								<Switch
									checked={et.isActive}
									onCheckedChange={(checked) =>
										toggleActive.mutate({ id: et.id, isActive: checked })
									}
								/>
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={() => deleteEventType.mutate({ id: et.id })}
									disabled={deleteEventType.isPending}
								>
									{deleteEventType.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Trash2 className="size-4 text-muted-foreground" />
									)}
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="pt-2">
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<Clock className="size-3.5" />
								{formatDuration(et.durationMinutes)}
							</div>
							<div className="flex items-center gap-1.5">
								<AlertCircle className="size-3.5" />
								{editingNotice === et.id ? (
									<div className="flex items-center gap-1">
										<Input
											type="number"
											min={0}
											max={168}
											value={noticeValue}
											onChange={(e) => setNoticeValue(e.target.value)}
											className="h-7 w-20 text-xs"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													updateEventType.mutate({
														id: et.id,
														minimumNoticeHours: Number(noticeValue) || 0,
													});
												}
												if (e.key === "Escape") setEditingNotice(null);
											}}
										/>
										<span className="text-xs">h</span>
										<Button
											variant="ghost"
											size="icon-sm"
											className="size-6"
											disabled={updateEventType.isPending}
											onClick={() => {
												updateEventType.mutate({
													id: et.id,
													minimumNoticeHours: Number(noticeValue) || 0,
												});
											}}
										>
											{updateEventType.isPending ? (
												<Loader2 className="size-3 animate-spin" />
											) : (
												<Check className="size-3" />
											)}
										</Button>
									</div>
								) : (
									<button
										type="button"
										className="flex items-center gap-1 hover:text-foreground"
										onClick={() => {
											setEditingNotice(et.id);
											setNoticeValue(String(et.minimumNoticeHours));
										}}
									>
										{formatNotice(et.minimumNoticeHours)} notice
										<Pencil className="size-3" />
									</button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
