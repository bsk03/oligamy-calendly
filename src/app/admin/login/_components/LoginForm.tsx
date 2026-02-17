"use client";

import { authClient } from "@/server/better-auth/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
	email: z.string().email("Invalid email"),
	password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
	});

	async function onSubmit(data: LoginValues) {
		setServerError(null);

		const { error } = await authClient.signIn.email({
			email: data.email,
			password: data.password,
		});

		if (error) {
			setServerError(error.message ?? "Login failed");
			return;
		}

		router.push("/admin");
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="admin@example.com"
					{...register("email")}
				/>
				{errors.email && (
					<p className="text-destructive text-sm">{errors.email.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="********"
					{...register("password")}
				/>
				{errors.password && (
					<p className="text-destructive text-sm">
						{errors.password.message}
					</p>
				)}
			</div>

			{serverError && (
				<p className="text-destructive text-sm">{serverError}</p>
			)}

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Signing in..." : "Sign in"}
			</Button>
		</form>
	);
}
