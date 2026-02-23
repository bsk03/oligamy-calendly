import { z } from "zod/v4";

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));

export const timezoneSchema = z
	.string()
	.refine((v) => validTimezones.has(v), "Invalid timezone");
