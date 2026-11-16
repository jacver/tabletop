import { defineConfig, devices } from "@playwright/test";

// Not 4173 (`vite preview`'s default), so it can't collide with a preview
// server a developer has running.
const PORT = 4310;

export default defineConfig({
	testDir: "tests/e2e",
	testIgnore: "spa.spec.ts",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI
		? [
				["github"],
				["html", { open: "never", outputFolder: "playwright-report" }],
			]
		: "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "on-first-retry",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		// Never attach to a server that's already running: it could be serving a
		// stale or different build, and the tests would silently check that.
		reuseExistingServer: false,
		timeout: 180_000,
	},
});
