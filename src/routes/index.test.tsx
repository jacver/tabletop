import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/config/app";
import { routeTree } from "@/routeTree.gen";
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
		// Load "/" through the real route tree, so the title comes from the
		// root route's head() exactly as the router resolves it.
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: ["/"] }),
		});
		await router.load();
		const titles = router.state.matches.flatMap((match) =>
			(match.meta ?? []).flatMap((m) =>
				m && typeof m.title === "string" ? [m.title] : [],
			),
		);
		expect(titles).toContain(APP_NAME);
	});

	it('home route renders a "Get started" button', () => {
		renderHome();
		expect(
			screen.getByRole("button", { name: "Get started" }),
		).toBeInTheDocument();
	});
});
