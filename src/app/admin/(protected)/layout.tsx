import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";

export default async function AdminProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session) {
		redirect("/admin/login");
	}

	return <>{children}</>;
}
