import { expect, test } from "@playwright/test";

// Throwaway F01 canary: CI must fail on this and upload the report.
// Reverted in the next commit.
test("ci canary fails on purpose", async ({ page }) => {
	await page.goto("/");
	expect(1).toBe(2);
});
