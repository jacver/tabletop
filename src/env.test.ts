import { describe, expect, it } from "vitest";
import { parseEnv, requireDatabaseUrl } from "./env";

describe("env", () => {
	it("env parses an empty environment without throwing", () => {
		expect(() => parseEnv({})).not.toThrow();
	});

	it("env accepts a postgres DATABASE_URL", () => {
		for (const url of [
			"postgres://tabletop:tabletop@localhost:5432/tabletop",
			"postgresql://tabletop:tabletop@localhost:5432/tabletop",
		]) {
			expect(parseEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
		}
	});

	it("env rejects a DATABASE_URL that is not a postgres url", () => {
		expect(() =>
			parseEnv({ DATABASE_URL: "http://localhost:5432/tabletop" }),
		).toThrow();
		expect(() => parseEnv({ DATABASE_URL: "not a url" })).toThrow();
	});

	it("requireDatabaseUrl throws a helpful error when DATABASE_URL is missing", () => {
		expect(() => requireDatabaseUrl(parseEnv({}))).toThrow(
			/DATABASE_URL is not set\. Start Postgres with `pnpm db:up`/,
		);
		const url = "postgres://tabletop:tabletop@localhost:5432/tabletop";
		expect(requireDatabaseUrl(parseEnv({ DATABASE_URL: url }))).toBe(url);
	});
});
