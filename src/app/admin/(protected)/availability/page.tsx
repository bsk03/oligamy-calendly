import { Separator } from "@/components/ui/separator";

import { OverridesList } from "./_components/OverridesList";
import { WeeklySchedule } from "./_components/WeeklySchedule";

export default function AvailabilityPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold tracking-tight">Availability</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Set your weekly availability and time-off overrides.
			</p>

			<div className="mt-6">
				<WeeklySchedule />
			</div>

			<Separator className="my-8" />

			<OverridesList />
		</div>
	);
}
