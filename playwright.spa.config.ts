import { defineConfig, devices } from "@playwright/test";

// Serves the client-only `build:spa` output from a plain static server, to
// prove it runs without the app server (as the mobile shell will in Phase 5).
const PORT = 4311;

export default defineConfig({
	testDir: "tests/e2e",
	testMatch: "spa.spec.ts",
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "on-first-retry",
	},
	projects: [{ name: "spa-chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `pnpm build:spa && sirv dist-spa/client --single --port ${PORT}`,
		url: `http://localhost:${PORT}`,
		// Never attach to a server that's already running: it could be serving a
		// stale or different build, and the tests would silently check that.
		reuseExistingServer: false,
		timeout: 180_000,
	},
});
