"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
	Loader2,
	Pencil,
	Plus,
	Save,
	Trash2,
	X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { toast } from "sonner";

function getInitials(name: string) {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

interface GroupDetailProps {
	groupId: string;
}

export function GroupDetail({ groupId }: GroupDetailProps) {
	const { data: group, isLoading } = api.group.getById.useQuery({ id: groupId });
	const { data: teamMembers } = api.team.list.useQuery();
	const utils = api.useUtils();

	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editSlug, setEditSlug] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editHostUserId, setEditHostUserId] = useState("");

	const newEtForm = useForm<NewEventTypeForm>({
		resolver: zodResolver(newEventTypeSchema),
		defaultValues: { title: "", durationMinutes: 30, description: "", minimumNoticeHours: 2 },
	});

	const [addMemberId, setAddMemberId] = useState("");

	const updateGroup = api.group.update.useMutation({
		onSuccess: () => {
			toast.success("Group updated");
			void utils.group.invalidate();
			setEditing(false);
		},
		onError: (err) => toast.error(err.message),
	});

	const deleteGroup = api.group.delete.useMutation({
		onSuccess: () => {
			toast.success("Group deleted");
			void utils.group.list.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const addMember = api.group.addMember.useMutation({
		onSuccess: () => {
			toast.success("Member added");
			void utils.group.getById.invalidate({ id: groupId });
			void utils.group.list.invalidate();
			setAddMemberId("");
		},
		onError: (err) => toast.error(err.message),
	});

	const removeMember = api.group.removeMember.useMutation({
		onSuccess: () => {
			toast.success("Member removed");
			void utils.group.getById.invalidate({ id: groupId });
			void utils.group.list.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	const createEventType = api.group.createEventType.useMutation({
		onSuccess: () => {
			toast.success("Event type created");
			void utils.group.getById.invalidate({ id: groupId });
			newEtForm.reset();
		},
		onError: (err) => toast.error(err.message),
	});

	const toggleEventType = api.group.updateEventType.useMutation({
		onSuccess: () => {
			void utils.group.getById.invalidate({ id: groupId });
		},
		onError: (err) => toast.error(err.message),
	});

	const deleteEventType = api.group.deleteEventType.useMutation({
		onSuccess: () => {
			toast.success("Event type deleted");
			void utils.group.getById.invalidate({ id: groupId });
		},
		onError: (err) => toast.error(err.message),
	});

	if (isLoading || !group) {
		return (
			<div className="flex items-center justify-center py-8 text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
			</div>
		);
	}

	function startEditing() {
		if (!group) return;
		setEditName(group.name);
		setEditSlug(group.slug);
		setEditDescription(group.description ?? "");
		setEditHostUserId(group.hostUserId);
		setEditing(true);
	}

	function handleSave() {
		updateGroup.mutate({
			id: groupId,
			name: editName.trim(),
			slug: editSlug.trim(),
			description: editDescription.trim() || null,
			hostUserId: editHostUserId,
		});
	}

	// Members not yet in the group
	const availableMembers = (teamMembers ?? []).filter(
		(m) => !group.members.some((gm) => gm.userId === m.id),
	);

	return (
		<div className="space-y-6">
			{/* Group info */}
			<div>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="text-sm font-semibold">Details</h3>
					<div className="flex gap-2">
						{editing ? (
							<>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setEditing(false)}
								>
									<X className="size-3.5" />
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleSave}
									disabled={updateGroup.isPending}
								>
									{updateGroup.isPending ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Save className="size-3.5" />
									)}
									Save
								</Button>
							</>
						) : (
							<>
								<Button
									size="sm"
									variant="ghost"
									onClick={startEditing}
								>
									<Pencil className="size-3.5" />
									Edit
								</Button>
								<Button
									size="sm"
									variant="destructive"
									onClick={() => {
										if (confirm("Delete this group?")) {
											deleteGroup.mutate({ id: groupId });
										}
									}}
									disabled={deleteGroup.isPending}
								>
									<Trash2 className="size-3.5" />
								</Button>
							</>
						)}
					</div>
				</div>

				{editing ? (
					<div className="grid gap-3">
						<div className="grid gap-1.5">
							<Label className="text-xs">Name</Label>
							<Input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="h-8 text-sm"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label className="text-xs">Slug</Label>
							<Input
								value={editSlug}
								onChange={(e) => setEditSlug(e.target.value)}
								className="h-8 text-sm"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label className="text-xs">Description</Label>
							<Textarea
								value={editDescription}
								onChange={(e) => setEditDescription(e.target.value)}
								rows={2}
								className="text-sm"
							/>
						</div>
						<div className="grid gap-1.5">
							<Label className="text-xs">Host</Label>
							<Select
								value={editHostUserId}
								onValueChange={setEditHostUserId}
							>
								<SelectTrigger className="h-8 text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{teamMembers?.map((m) => (
										<SelectItem key={m.id} value={m.id}>
											{m.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				) : (
					<div className="text-sm text-muted-foreground space-y-1">
						{group.description && <p>{group.description}</p>}
						<p>
							Host: <span className="font-medium text-foreground">{group.host?.name}</span>
						</p>
						<p>
							Active:{" "}
							<span className="font-medium text-foreground">
								{group.isActive ? "Yes" : "No"}
							</span>
						</p>
					</div>
				)}
			</div>

			{/* Host & Members */}
			<div>
				<h3 className="mb-3 text-sm font-semibold">
					Team ({group.members.length + 1})
				</h3>

				<div className="space-y-2">
					{/* Host */}
					{group.host && (
						<div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
							<Avatar className="size-7">
								<AvatarImage
									src={group.host.image ?? undefined}
									alt={group.host.name}
								/>
								<AvatarFallback className="text-[10px]">
									{getInitials(group.host.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<span className="text-sm">{group.host.name}</span>
								<span className="ml-1 text-xs text-muted-foreground">
									{group.host.email}
								</span>
							</div>
							<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
								Host
							</Badge>
						</div>
					)}

					{/* Members */}
					{group.members.map((member) => (
						<div
							key={member.userId}
							className="flex items-center gap-2 rounded-md border px-3 py-2"
						>
							<Avatar className="size-7">
								<AvatarImage
									src={member.avatarUrl ?? member.image ?? undefined}
									alt={member.name}
								/>
								<AvatarFallback className="text-[10px]">
									{getInitials(member.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<span className="text-sm">{member.name}</span>
								<span className="ml-1 text-xs text-muted-foreground">
									{member.email}
								</span>
							</div>
							<Button
								size="sm"
								variant="ghost"
								className="size-7 p-0"
								onClick={() =>
									removeMember.mutate({
										groupId,
										userId: member.userId,
									})
								}
								disabled={removeMember.isPending}
							>
								<X className="size-3.5" />
							</Button>
						</div>
					))}
				</div>

				{/* Add member */}
				{availableMembers.length > 0 && (
					<div className="mt-3 flex gap-2">
						<Select value={addMemberId} onValueChange={setAddMemberId}>
							<SelectTrigger className="h-8 flex-1 text-sm">
								<SelectValue placeholder="Add member..." />
							</SelectTrigger>
							<SelectContent>
								{availableMembers.map((m) => (
									<SelectItem key={m.id} value={m.id}>
										{m.name} ({m.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							size="sm"
							className="h-8"
							disabled={!addMemberId || addMember.isPending}
							onClick={() => {
								if (addMemberId) {
									addMember.mutate({
										groupId,
										userId: addMemberId,
									});
								}
							}}
						>
							{addMember.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Plus className="size-3.5" />
							)}
							Add
						</Button>
					</div>
				)}
			</div>

			{/* Event Types */}
			<div>
				<h3 className="mb-3 text-sm font-semibold">
					Event Types ({group.eventTypes.length})
				</h3>

				<div className="space-y-2">
					{group.eventTypes.map((et) => (
						<GroupEventTypeRow
							key={et.id}
							et={et}
							onToggle={(checked) =>
								toggleEventType.mutate({ id: et.id, isActive: checked })
							}
							onUpdateNotice={(hours) =>
								toggleEventType.mutate({ id: et.id, minimumNoticeHours: hours })
							}
							onDelete={() => {
								if (confirm("Delete this event type?")) {
									deleteEventType.mutate({ id: et.id });
								}
							}}
						/>
					))}
				</div>

				{/* Create event type */}
				<form
					className="mt-3 rounded-md border p-3"
					onSubmit={newEtForm.handleSubmit((data) => {
						createEventType.mutate({
							groupId,
							title: data.title.trim(),
							durationMinutes: data.durationMinutes,
							description: data.description?.trim() || undefined,
							minimumNoticeHours: data.minimumNoticeHours,
						});
					})}
				>
					<p className="mb-2 text-xs font-medium text-muted-foreground">
						Add Event Type
					</p>
					<div className="grid gap-2">
						<div className="flex gap-2">
							<Input
								placeholder="Title (e.g. Sales Call)"
								className="h-8 text-sm flex-1"
								{...newEtForm.register("title")}
							/>
							<Input
								type="number"
								placeholder="Min"
								className="h-8 text-sm w-20"
								min={5}
								max={480}
								{...newEtForm.register("durationMinutes", { valueAsNumber: true })}
							/>
						</div>
						<div className="flex gap-2">
							<Input
								placeholder="Description (optional)"
								className="h-8 text-sm flex-1"
								{...newEtForm.register("description")}
							/>
							<div className="flex items-center gap-1">
								<Input
									type="number"
									className="h-8 text-sm w-16"
									min={0}
									max={168}
									{...newEtForm.register("minimumNoticeHours", { valueAsNumber: true })}
								/>
								<span className="text-xs text-muted-foreground whitespace-nowrap">h notice</span>
							</div>
						</div>
						<Button
							type="submit"
							size="sm"
							className="h-8"
							disabled={createEventType.isPending}
						>
							{createEventType.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Plus className="size-3.5" />
							)}
							Add Event Type
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Schemas ─────────────────────────────────────────────────────

const newEventTypeSchema = z.object({
	title: z.string().min(1),
	durationMinutes: z.number().int().min(5).max(480),
	description: z.string().optional(),
	minimumNoticeHours: z.number().int().min(0).max(168),
});

type NewEventTypeForm = z.infer<typeof newEventTypeSchema>;

const editNoticeSchema = z.object({
	minimumNoticeHours: z.number().int().min(0).max(168),
});

type EditNoticeForm = z.infer<typeof editNoticeSchema>;

// ─── GroupEventTypeRow ───────────────────────────────────────────

function formatNotice(hours: number) {
	if (hours === 0) return "No";
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	const rem = hours % 24;
	return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function GroupEventTypeRow({
	et,
	onToggle,
	onUpdateNotice,
	onDelete,
}: {
	et: {
		id: string;
		title: string;
		durationMinutes: number;
		description: string | null;
		isActive: boolean;
		minimumNoticeHours: number;
	};
	onToggle: (checked: boolean) => void;
	onUpdateNotice: (hours: number) => void;
	onDelete: () => void;
}) {
	const [editingNotice, setEditingNotice] = useState(false);

	const noticeForm = useForm<EditNoticeForm>({
		resolver: zodResolver(editNoticeSchema),
		defaultValues: { minimumNoticeHours: et.minimumNoticeHours },
	});

	const handleNoticeSave = (data: EditNoticeForm) => {
		if (data.minimumNoticeHours !== et.minimumNoticeHours) {
			onUpdateNotice(data.minimumNoticeHours);
		}
		setEditingNotice(false);
	};

	return (
		<div className="flex items-center gap-3 rounded-md border px-3 py-2">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">{et.title}</span>
					<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
						{et.durationMinutes} min
					</Badge>
					{editingNotice ? (
						<form
							onSubmit={noticeForm.handleSubmit(handleNoticeSave)}
							className="flex items-center gap-1"
						>
							<Input
								type="number"
								className="h-6 w-14 text-[10px] px-1.5"
								min={0}
								max={168}
								autoFocus
								{...noticeForm.register("minimumNoticeHours", { valueAsNumber: true })}
								onBlur={noticeForm.handleSubmit(handleNoticeSave)}
							/>
							<span className="text-[10px] text-muted-foreground">h</span>
						</form>
					) : (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted"
							onClick={() => {
								noticeForm.reset({ minimumNoticeHours: et.minimumNoticeHours });
								setEditingNotice(true);
							}}
						>
							{formatNotice(et.minimumNoticeHours)} notice
						</Badge>
					)}
					{!et.isActive && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0">
							Inactive
						</Badge>
					)}
				</div>
				{et.description && (
					<p className="text-xs text-muted-foreground truncate">
						{et.description}
					</p>
				)}
			</div>
			<Switch checked={et.isActive} onCheckedChange={onToggle} />
			<Button
				size="sm"
				variant="ghost"
				className="size-7 p-0 text-destructive hover:text-destructive"
				onClick={onDelete}
			>
				<Trash2 className="size-3.5" />
			</Button>
		</div>
	);
}
