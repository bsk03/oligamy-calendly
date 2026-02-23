"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TIMEZONES } from "@/lib/timezones";
import { cn } from "@/lib/utils";

interface TimezoneComboboxProps {
	value: string;
	onChange: (tz: string) => void;
	className?: string;
	triggerClassName?: string;
}

export function TimezoneCombobox({
	value,
	onChange,
	className,
	triggerClassName,
}: TimezoneComboboxProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-full justify-between font-normal",
						triggerClassName,
					)}
				>
					<span className="truncate">
						{value.replace(/_/g, " ")}
					</span>
					<ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn("w-[280px] p-0", className)}
				align="start"
			>
				<Command>
					<CommandInput placeholder="Search timezone..." />
					<CommandList>
						<CommandEmpty>No timezone found.</CommandEmpty>
						<CommandGroup>
							{TIMEZONES.map((tz) => (
								<CommandItem
									key={tz}
									value={tz}
									onSelect={() => {
										onChange(tz);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-1.5 size-3.5",
											value === tz
												? "opacity-100"
												: "opacity-0",
										)}
									/>
									{tz.replace(/_/g, " ")}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
