'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	CalendarDays,
	Clock,
	Home,
	LinkIcon,
	ListChecks,
	LogOut,
	Settings,
	Users,
	UsersRound,
} from 'lucide-react';

import { authClient } from '@/server/better-auth/client';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from '@/components/ui/sidebar';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

const mainNav = [
	{ title: 'Dashboard', href: '/admin', icon: Home, statusKey: null },
	{
		title: 'Bookings',
		href: '/admin/bookings',
		icon: CalendarDays,
		statusKey: null,
	},
	{
		title: 'Availability',
		href: '/admin/availability',
		icon: Clock,
		statusKey: 'hasAvailability' as const,
	},
	{
		title: 'Event Types',
		href: '/admin/event-types',
		icon: ListChecks,
		statusKey: 'hasEventTypes' as const,
	},
];

const settingsNav = [
	{
		title: 'Integrations',
		href: '/admin/integrations',
		icon: LinkIcon,
		statusKey: 'hasGoogleCalendar' as const,
	},
	{
		title: 'Team',
		href: '/admin/team',
		icon: Users,
		statusKey: null,
		adminOnly: false,
	},
	{
		title: 'Groups',
		href: '/admin/groups',
		icon: UsersRound,
		statusKey: null,
		adminOnly: true,
	},
	{
		title: 'Settings',
		href: '/admin/settings',
		icon: Settings,
		statusKey: 'hasProfile' as const,
	},
];

type StatusKey =
	| 'hasProfile'
	| 'hasEventTypes'
	| 'hasAvailability'
	| 'hasGoogleCalendar';

function SetupDot() {
	return <span className='size-2 rounded-full bg-red-500' />;
}

export function AdminSidebar({ email, role }: { email: string; role: string }) {
	const pathname = usePathname();
	const isAdmin = role === 'admin';

	const { data: status } = api.profile.setupStatus.useQuery(undefined, {
		staleTime: 30_000,
	});

	function needsAttention(key: StatusKey | null): boolean {
		if (!key || !status) return false;
		return !status[key];
	}

	async function handleSignOut() {
		await authClient.signOut();
		toast.success('Signed out');
		window.location.href = '/admin/login';
	}

	return (
		<Sidebar collapsible='icon'>
			<SidebarHeader className=' px-4'>
				<Link
					href='/admin'
					className='flex items-center h-full gap-2 py-[0.34375rem] group-data-[collapsible=icon]:justify-center'
				>
					<img src='/Subtract.svg' alt='Oligamy' className='size-7' />
					<span className='text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden'>
						Oligamy Cal
					</span>
				</Link>
			</SidebarHeader>

			<SidebarSeparator className='mx-0' />

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Menu</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainNav.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										isActive={pathname === item.href}
										tooltip={item.title}
									>
										<Link href={item.href}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
									{needsAttention(item.statusKey) && (
										<SidebarMenuBadge>
											<SetupDot />
										</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Settings</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{settingsNav
								.filter((item) => !item.adminOnly || isAdmin)
								.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											asChild
											isActive={pathname === item.href}
											tooltip={item.title}
										>
											<Link href={item.href}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
										{needsAttention(item.statusKey) && (
											<SidebarMenuBadge>
												<SetupDot />
											</SidebarMenuBadge>
										)}
									</SidebarMenuItem>
								))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarSeparator />
				<SidebarMenu>
					<SidebarMenuItem>
						<div className='flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden'>
							<div className='flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground'>
								{email[0]?.toUpperCase()}
							</div>
							<span className='truncate text-xs text-muted-foreground'>
								{email}
							</span>
						</div>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton onClick={handleSignOut} tooltip='Sign out'>
							<LogOut />
							<span>Sign out</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
