import { expect, test } from "@playwright/test";
import { APP_NAME } from "../../src/config/app";

test("home page loads with status 200 and shows the app name", async ({
	page,
}) => {
	const response = await page.goto("/");
	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: APP_NAME }),
	).toBeVisible();
	await expect(page).toHaveTitle(APP_NAME);
});

test("tailwind styles are applied to the home heading", async ({ page }) => {
	await page.goto("/");
	const heading = page.getByRole("heading", { level: 1, name: APP_NAME });
	// `font-bold` sets font-weight: 700; the browser default for <h1> is also
	// bold, so check `text-4xl` (2.25rem = 36px) too, which no default sets.
	await expect(heading).toHaveCSS("font-weight", "700");
	await expect(heading).toHaveCSS("font-size", "36px");
});
