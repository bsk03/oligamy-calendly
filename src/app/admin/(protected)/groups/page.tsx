import { getSession } from "@/server/better-auth/server";
import { redirect } from "next/navigation";

import { GroupManager } from "./_components/GroupManager";

export default async function GroupsPage() {
	const session = await getSession();
	if (session?.user.role !== "admin") {
		redirect("/admin");
	}

	return (
		<div>
			<h1 className="text-2xl font-bold tracking-tight">Groups</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Create and manage booking groups. Each group has a host and members
				with shared availability.
			</p>
			<div className="mt-6">
				<GroupManager />
			</div>
		</div>
	);
}
