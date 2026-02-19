import { CreateEventTypeDialog } from "./_components/CreateEventTypeDialog";
import { EventTypeList } from "./_components/EventTypeList";

export default function EventTypesPage() {
	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Create and manage your meeting types.
					</p>
				</div>
				<CreateEventTypeDialog />
			</div>

			<div className="mt-6">
				<EventTypeList />
			</div>
		</div>
	);
}
