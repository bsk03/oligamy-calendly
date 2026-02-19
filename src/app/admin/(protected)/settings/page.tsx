import { ProfileSettings } from "./_components/ProfileSettings";

export default function SettingsPage() {
	return (
		<div>
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your profile, timezone, and preferences.
				</p>
			</div>

			<div className="mt-6 max-w-2xl">
				<ProfileSettings />
			</div>
		</div>
	);
}
