import { Separator } from "@/components/ui/separator";
import { getSession } from "@/server/better-auth/server";

import { InvitationList } from "./_components/InvitationList";
import { InviteForm } from "./_components/InviteForm";
import { TeamMemberList } from "./_components/TeamMemberList";

export default async function TeamPage() {
	const session = await getSession();
	const isAdmin = session?.user.role === "admin";

	return (
		<div>
			<h1 className="text-2xl font-bold tracking-tight">Team</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{isAdmin
					? "Manage team members and invite new people."
					: "People in your team."}
			</p>

			<div className="mt-6">
				<h2 className="text-lg font-semibold">Members</h2>
				<p className="mb-4 text-sm text-muted-foreground">
					{isAdmin
						? "All registered users. Toggle visibility on the booking page."
						: "All registered team members."}
				</p>
				<TeamMemberList isAdmin={isAdmin} currentUserId={session?.user.id} />
			</div>

			{isAdmin && (
				<>
					<Separator className="my-8" />

					<div>
						<InviteForm />
					</div>

					<Separator className="my-8" />

					<div>
						<h2 className="text-lg font-semibold">Invitations</h2>
						<p className="mb-4 text-sm text-muted-foreground">
							All sent invitations and their status.
						</p>
						<InvitationList />
					</div>
				</>
			)}
		</div>
	);
}
