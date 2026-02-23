"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

const registerSchema = z
	.object({
		name: z
			.string()
			.min(1, "Name is required")
			.max(100, "Name is too long"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token") ?? "";
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		data: invite,
		isLoading: isLoadingToken,
		error: tokenError,
	} = api.invitation.getByToken.useQuery(
		{ token },
		{ enabled: !!token, retry: false },
	);

	const acceptInvitation = api.invitation.acceptInvitation.useMutation({
		onSuccess: () => {
			toast.success("Account created! Redirecting to login...");
			router.push("/admin/login?registered=1");
		},
		onError: (err) => {
			setServerError(err.message);
			toast.error(err.message);
		},
	});

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			password: "",
			confirmPassword: "",
		},
	});

	if (!token) {
		return (
			<p className="text-sm text-destructive">
				Missing invitation token. Please use the link from your email.
			</p>
		);
	}

	if (isLoadingToken) {
		return (
			<div className="flex items-center justify-center py-8 text-muted-foreground">
				<Loader2 className="size-5 animate-spin" />
			</div>
		);
	}

	if (tokenError) {
		return (
			<p className="text-sm text-destructive">{tokenError.message}</p>
		);
	}

	function onSubmit(data: RegisterValues) {
		setServerError(null);
		acceptInvitation.mutate({
			token,
			name: data.name.trim(),
			password: data.password,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input id="email" type="email" value={invite?.email ?? ""} disabled />
			</div>

			<div className="space-y-2">
				<Label htmlFor="name">Full name</Label>
				<Input
					id="name"
					placeholder="Jan Kowalski"
					autoFocus
					{...register("name")}
				/>
				{errors.name && (
					<p className="text-sm text-destructive">{errors.name.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Min. 8 characters"
					{...register("password")}
				/>
				{errors.password && (
					<p className="text-sm text-destructive">{errors.password.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="confirmPassword">Confirm password</Label>
				<Input
					id="confirmPassword"
					type="password"
					placeholder="Repeat password"
					{...register("confirmPassword")}
				/>
				{errors.confirmPassword && (
					<p className="text-sm text-destructive">
						{errors.confirmPassword.message}
					</p>
				)}
			</div>

			{serverError && (
				<p className="text-sm text-destructive">{serverError}</p>
			)}

			<Button
				type="submit"
				className="w-full"
				disabled={acceptInvitation.isPending}
			>
				{acceptInvitation.isPending ? "Creating account..." : "Create account"}
			</Button>
		</form>
	);
}
