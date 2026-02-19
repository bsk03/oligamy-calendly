"use client";

import { format } from "date-fns";
import { Loader2, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { InvitationStatus } from "@/server/db/schema";
import { api } from "@/trpc/react";

export function InvitationList() {
	const { data: invitations, isLoading } = api.invitation.list.useQuery();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	if (!invitations?.length) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
				No invitations sent yet.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{invitations.map((inv) => {
				const expired =
					inv.status === InvitationStatus.PENDING && new Date() > inv.expiresAt;

				return (
					<div
						key={inv.id}
						className="flex items-center justify-between rounded-lg border px-4 py-3"
					>
						<div className="flex items-center gap-3">
							<Mail className="size-4 text-muted-foreground" />
							<span className="text-sm font-medium">{inv.email}</span>
						</div>
						<div className="flex items-center gap-3">
							<span className="text-xs text-muted-foreground">
								{format(new Date(inv.createdAt), "d MMM yyyy")}
							</span>
							<Badge
								variant={
									inv.status === "ACCEPTED"
										? "default"
										: expired
											? "destructive"
											: "secondary"
								}
							>
								{inv.status === "ACCEPTED"
									? "Accepted"
									: expired
										? "Expired"
										: "Pending"}
							</Badge>
						</div>
					</div>
				);
			})}
		</div>
	);
}
