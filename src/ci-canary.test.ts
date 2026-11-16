import { expect, test } from "vitest";

// Throwaway F01 canary: CI must fail on this. Reverted in the next commit.
test("ci canary fails on purpose", () => {
	expect(1).toBe(2);
});
