/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Tylko ikony faktycznie używane w kodzie trafią do bundle'a (tree-shaking)
	optimizePackageImports: ["@phosphor-icons/react"],
};

export default config;
