import { defineConfig, devices } from "@playwright/test";

// Serves the client-only `build:spa` output from a plain static server, to
// prove it runs without the app server (as the mobile shell will in Phase 5).
const PORT = 4174;

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
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
});
