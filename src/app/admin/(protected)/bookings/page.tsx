import { getSession } from "@/server/better-auth/server";

import { BookingsList, SyncStatusesButton } from "./_components/BookingsList";

export default async function BookingsPage() {
	const session = await getSession();
	const isAdmin = session?.user.role === "admin";

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{isAdmin
							? "Browse all bookings across team members."
							: "Your upcoming and past bookings."}
					</p>
				</div>
				<SyncStatusesButton />
			</div>

			<div className="mt-6">
				<BookingsList isAdmin={isAdmin} />
			</div>
		</div>
	);
}
