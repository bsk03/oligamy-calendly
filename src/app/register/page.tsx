import { Suspense } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./_components/RegisterForm";

export default function RegisterPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-white">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Create your account</CardTitle>
					<CardDescription>
						You&apos;ve been invited to join Oligamy Cal
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Suspense>
						<RegisterForm />
					</Suspense>
				</CardContent>
			</Card>
		</div>
	);
}
