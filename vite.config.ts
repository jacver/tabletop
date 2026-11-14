/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `pnpm build:spa` sets BUILD_TARGET=spa: a client-only static build (used by
// the mobile shell in Phase 5). All SSR/SPA differences live here.
const isSpa = process.env.BUILD_TARGET === "spa";
const isVitest = process.env.VITEST === "true";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		tailwindcss(),
		// The Start plugin builds the SSR/server bundles; unit tests render
		// components directly and don't need it.
		!isVitest &&
			tanstackStart({
				// Colocated tests live next to routes; keep them out of the tree.
				router: { routeFileIgnorePattern: "\\.test\\.tsx?$" },
				...(isSpa && {
					spa: { enabled: true, prerender: { outputPath: "/index.html" } },
				}),
			}),
		viteReact(),
	],
	build: isSpa ? { outDir: "dist-spa" } : undefined,
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["./src/test/setup.ts"],
	},
});
