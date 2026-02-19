import { redirect } from 'next/navigation';

import { getSession } from '@/server/better-auth/server';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AdminSidebar } from './_components/AdminSidebar';

export default async function AdminProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session) {
		redirect('/admin/login');
	}

	return (
		<SidebarProvider>
			<AdminSidebar email={session?.user.email ?? ''} role={session?.user.role ?? 'user'} />
			<SidebarInset>
				<header className='flex h-14 items-center gap-2 border-b px-4'>
					<SidebarTrigger className='-ml-1' />
					<Separator orientation='vertical' className='mr-2 h-4' />
					<span className='text-sm font-medium text-muted-foreground'>
						Admin Panel
					</span>
				</header>
				<main className='flex-1 p-6'>{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
