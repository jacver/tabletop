import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/config/app";
import { Route as RootRoute } from "./__root";
import { Route as IndexRoute } from "./index";

function renderHome() {
	const Home = IndexRoute.options.component;
	if (!Home) throw new Error("index route has no component");
	render(<Home />);
}

describe("home route", () => {
	it("home route renders the APP_NAME constant as the page heading", () => {
		renderHome();
		expect(
			screen.getByRole("heading", { level: 1, name: APP_NAME }),
		).toBeInTheDocument();
	});

	it("document title includes APP_NAME", async () => {
		const head = await RootRoute.options.head?.(
			{} as Parameters<NonNullable<typeof RootRoute.options.head>>[0],
		);
		const titles = (head?.meta ?? []).flatMap((m) =>
			m && "title" in m && typeof m.title === "string" ? [m.title] : [],
		);
		expect(titles.some((t) => t.includes(APP_NAME))).toBe(true);
	});

	it('home route renders a "Get started" button', () => {
		renderHome();
		expect(
			screen.getByRole("button", { name: "Get started" }),
		).toBeInTheDocument();
	});
});
