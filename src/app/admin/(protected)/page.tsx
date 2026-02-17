import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/server/better-auth/server";

export default async function AdminDashboardPage() {
	const session = await getSession();

	return (
		<div className="flex min-h-screen items-center justify-center bg-white">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Admin Dashboard</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						You are logged in as{" "}
						<span className="text-foreground font-medium">
							{session?.user.email}
						</span>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
