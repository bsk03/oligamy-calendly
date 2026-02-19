import { getSession } from "@/server/better-auth/server";

import { DashboardContent } from "./_components/DashboardContent";

export default async function AdminDashboardPage() {
	const session = await getSession();

	return (
		<DashboardContent
			isAdmin={session?.user.role === "admin"}
			userName={session?.user.name ?? ""}
		/>
	);
}
