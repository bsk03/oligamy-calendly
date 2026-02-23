"use client";

import { useState } from "react";
import {
	ExternalLink,
	Loader2,
	Plus,
	Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { env } from "@/env";

import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupDetail } from "./GroupDetail";

export function GroupManager() {
	const [showCreate, setShowCreate] = useState(false);
	const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

	const { data: groups, isLoading } = api.group.list.useQuery();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-semibold">All Groups</h2>
				<Button size="sm" onClick={() => setShowCreate(true)}>
					<Plus className="size-3.5" />
					Create Group
				</Button>
			</div>

			{!groups?.length ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					No groups yet. Create one to get started.
				</div>
			) : (
				<div className="grid gap-3">
					{groups.map((g) => (
						<div key={g.id}>
							<button
								type="button"
								onClick={() =>
									setExpandedGroupId(
										expandedGroupId === g.id ? null : g.id,
									)
								}
								className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
							>
								<div className="flex size-9 items-center justify-center rounded-lg bg-gray-100">
									<Users className="size-4 text-gray-600" />
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium truncate">
											{g.name}
										</span>
										{!g.isActive && (
											<Badge
												variant="secondary"
												className="text-[10px] px-1.5 py-0"
											>
												Inactive
											</Badge>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										Host: {g.hostName} &middot;{" "}
										{g.memberCount} member
										{g.memberCount !== 1 ? "s" : ""}
									</p>
								</div>

								<a
									href={`${env.NEXT_PUBLIC_APP_URL}/book/${g.slug}`}
									target="_blank"
									rel="noopener noreferrer"
									onClick={(e) => e.stopPropagation()}
									className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
								>
									<ExternalLink className="size-3" />
									{g.slug}
								</a>
							</button>

							{expandedGroupId === g.id && (
								<div className="mt-1 rounded-lg border bg-muted/20 p-4">
									<GroupDetail groupId={g.id} />
								</div>
							)}
						</div>
					))}
				</div>
			)}

			<CreateGroupDialog
				open={showCreate}
				onOpenChange={setShowCreate}
			/>
		</div>
	);
}
