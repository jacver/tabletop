import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("env", () => {
	it("env parses an empty environment without throwing", () => {
		expect(() => parseEnv({})).not.toThrow();
	});
});
