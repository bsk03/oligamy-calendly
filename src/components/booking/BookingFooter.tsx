import { Github } from "lucide-react";

export function BookingFooter() {
	return (
		<footer id="oligamy-branding" className="flex items-center justify-center gap-3 pt-2 text-[12px] text-muted-foreground">
			<a
				href="https://oligamy.com"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-1.5 transition-colors hover:text-foreground"
			>
				<span>vibecoded by</span>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src="/logo.svg"
					alt="Oligamy"
					className="h-5 w-auto"
				/>
			</a>
			<span className="text-border">|</span>
			<a
				href="https://github.com"
				target="_blank"
				rel="noopener noreferrer"
				className="transition-colors hover:text-foreground"
			>
				<Github className="size-3.5" />
			</a>
		</footer>
	);
}
