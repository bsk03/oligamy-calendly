"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function InviteForm() {
	const [email, setEmail] = useState("");

	const utils = api.useUtils();
	const invite = api.invitation.create.useMutation({
		onSuccess: () => {
			utils.invitation.list.invalidate();
			setEmail("");
			toast.success("Invitation sent!");
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!email.trim()) return;
		invite.mutate({ email: email.trim() });
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<Label htmlFor="invite-email">Invite by email</Label>
			<div className="flex gap-2">
				<Input
					id="invite-email"
					type="email"
					placeholder="colleague@company.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="max-w-sm"
				/>
				<Button type="submit" disabled={invite.isPending || !email.trim()}>
					{invite.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					Send Invite
				</Button>
			</div>
		</form>
	);
}
