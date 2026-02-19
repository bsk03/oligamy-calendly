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
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Group</DialogTitle>
					<DialogDescription>
						Create a booking group with a shared calendar. The
						group&apos;s slug becomes its subdomain URL.
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
						<Label htmlFor="group-slug">Slug (subdomain)</Label>
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
								URL: {slug}.your-domain.com
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
