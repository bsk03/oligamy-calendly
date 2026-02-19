import { GoogleCalendarCard } from "./_components/GoogleCalendarCard";

export default function IntegrationsPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Connect Google Calendar and other services.
			</p>

			<div className="mt-6 grid gap-4">
				<GoogleCalendarCard />
			</div>
		</div>
	);
}
