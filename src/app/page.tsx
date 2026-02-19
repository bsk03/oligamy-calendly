import { BookingCard } from "@/components/booking/BookingCard";
import { api, HydrateClient } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
	void api.user.list.prefetch();

	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
				<div className="flex flex-col items-center gap-6">
					<h1 className="text-2xl font-bold">Umów spotkanie</h1>
					<BookingCard />
				</div>
			</main>
		</HydrateClient>
	);
}
