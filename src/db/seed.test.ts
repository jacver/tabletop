import { describe, expect, it } from "vitest";
import { assertLocalDatabaseUrl } from "./seed.ts";

describe("seed cli", () => {
	it("seed cli refuses a non-local database host", () => {
		for (const url of [
			"postgres://tabletop:tabletop@db.example.com:5432/tabletop",
			"postgres://tabletop:tabletop@10.0.0.5:5432/tabletop",
			"postgres://tabletop:tabletop@localhost.example.com:5432/tabletop",
		]) {
			expect(() => assertLocalDatabaseUrl(url)).toThrow(/local/);
		}
	});

	it("seed cli accepts localhost, 127.0.0.1 and ::1", () => {
		for (const url of [
			"postgres://tabletop:tabletop@localhost:5432/tabletop",
			"postgres://tabletop:tabletop@127.0.0.1:5432/tabletop",
			"postgres://tabletop:tabletop@[::1]:5432/tabletop",
		]) {
			expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
		}
	});
});
