/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Tylko ikony faktycznie używane w kodzie trafią do bundle'a (tree-shaking)
	optimizePackageImports: ["@phosphor-icons/react"],

	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
					{ key: "X-DNS-Prefetch-Control", value: "on" },
					{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
				],
			},
		];
	},
};

export default config;
