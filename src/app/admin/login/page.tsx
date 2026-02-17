import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./_components/LoginForm";

export default function AdminLoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-white">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Admin Panel</CardTitle>
					<CardDescription>Sign in to continue</CardDescription>
				</CardHeader>
				<CardContent>
					<LoginForm />
				</CardContent>
			</Card>
		</div>
	);
}
