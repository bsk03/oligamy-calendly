"use client";

import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
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

export function TeamMemberList({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId?: string }) {
	const { data: members, isLoading } = api.team.list.useQuery();
	const utils = api.useUtils();

	const toggleVisibility = api.team.toggleVisibility.useMutation({
		onSuccess: () => {
			utils.team.list.invalidate();
			toast.success("Visibility updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const setRole = api.team.setRole.useMutation({
		onSuccess: () => {
			utils.team.list.invalidate();
			toast.success("Role updated");
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

	if (!members?.length) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
				No team members yet.
			</div>
		);
	}

	return (
		<TooltipProvider delayDuration={200}>
			<div className="grid gap-2">
				{members.map((member) => {
					const missing: string[] = [];
					if (!member.hasProfile) missing.push("Profile not configured");
					if (!member.hasEventTypes) missing.push("No active event types");
					if (!member.hasAvailability) missing.push("Availability not set");
					if (!member.hasGoogleCalendar) missing.push("Google Calendar not connected");
					const isReady = missing.length === 0;

					return (
						<div
							key={member.id}
							className="flex items-center gap-3 rounded-lg border px-4 py-3"
						>
							{/* Avatar */}
							<Avatar className="size-9">
								<AvatarImage
									src={member.avatarUrl ?? member.image ?? undefined}
									alt={member.name}
								/>
								<AvatarFallback className="text-xs">
									{getInitials(member.name)}
								</AvatarFallback>
							</Avatar>

							{/* Info */}
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium truncate">
										{member.name}
									</span>
									{isAdmin ? (
										<Select
											value={member.role ?? "user"}
											onValueChange={(value: "user" | "admin") =>
												setRole.mutate({ userId: member.id, role: value })
											}
											disabled={member.id === currentUserId || setRole.isPending}
										>
											<SelectTrigger className="h-5 w-[80px] text-[10px] px-1.5 py-0">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="user">User</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
											</SelectContent>
										</Select>
									) : (
										member.role === "admin" && (
											<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
												Admin
											</Badge>
										)
									)}
								</div>
								<p className="text-xs text-muted-foreground truncate">
									{member.email}
								</p>
							</div>

							{/* Admin: status dot + switch */}
							{isAdmin && (
								<div className="flex items-center gap-3">
									{/* Status dot with tooltip */}
									{!isReady && (
										<Tooltip>
											<TooltipTrigger asChild>
												<div className="size-2.5 shrink-0 rounded-full bg-red-500 cursor-help" />
											</TooltipTrigger>
											<TooltipContent side="left" className="max-w-[220px]">
												<p className="text-xs font-medium mb-1">Missing setup:</p>
												<ul className="text-xs space-y-0.5">
													{missing.map((m) => (
														<li key={m}>• {m}</li>
													))}
												</ul>
											</TooltipContent>
										</Tooltip>
									)}
									{isReady && (
										<div className="size-2.5 shrink-0 rounded-full bg-emerald-500" />
									)}

									{/* Visibility switch — only when profile exists */}
									<Tooltip>
										<TooltipTrigger asChild>
											<div>
												<Switch
													checked={member.isVisibleOnHome}
													disabled={
														!member.hasProfile ||
														toggleVisibility.isPending
													}
													onCheckedChange={(checked) =>
														toggleVisibility.mutate({
															userId: member.id,
															isVisibleOnHome: checked,
														})
													}
												/>
											</div>
										</TooltipTrigger>
										<TooltipContent side="left">
											{member.hasProfile
												? "Visible on booking page"
												: "User must configure profile first"}
										</TooltipContent>
									</Tooltip>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</TooltipProvider>
	);
}
