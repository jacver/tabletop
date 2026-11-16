import { expect, test } from "@playwright/test";
import { APP_NAME } from "../../src/config/app";

test("spa build serves the home page from a static server", async ({
	page,
}) => {
	const response = await page.goto("/");
	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: APP_NAME }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});
