import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { newOwnerId, testDb } from "../../test/db.ts";
import { gameSystems } from "./index.ts";

const db = testDb();

/** Resolves to the rejection reason, or fails the test if `promise` resolves. */
async function rejectionOf(promise: PromiseLike<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error("expected the query to fail");
}

describe("game_systems", () => {
	it("game_systems rejects a duplicate name for the same owner", async () => {
		const ownerId = newOwnerId();
		await db.insert(gameSystems).values({ ownerId, name: "Ironvale Skirmish" });

		const error = await rejectionOf(
			db.insert(gameSystems).values({ ownerId, name: "Ironvale Skirmish" }),
		);
		expect(error).toMatchObject({
			cause: { code: "23505", constraint: "game_systems_owner_name_uq" },
		});
	});

	it("game_systems allows the same name for different owners", async () => {
		const [first, second] = [newOwnerId(), newOwnerId()];
		await db.insert(gameSystems).values([
			{ ownerId: first, name: "Gloamreach Wars" },
			{ ownerId: second, name: "Gloamreach Wars" },
		]);

		const rows = await db
			.select({ ownerId: gameSystems.ownerId })
			.from(gameSystems)
			.where(eq(gameSystems.name, "Gloamreach Wars"));
		expect(rows.map((row) => row.ownerId)).toEqual(
			expect.arrayContaining([first, second]),
		);
	});

	it("game_systems requires owner_id", async () => {
		const error = await rejectionOf(
			db.execute(
				sql`insert into game_systems (name) values ('Cinderfall Tactics')`,
			),
		);
		expect(error).toMatchObject({
			cause: { code: "23502", column: "owner_id" },
		});
	});

	it("game_systems fills id and timestamps by default", async () => {
		const before = Date.now();
		const [row] = await db
			.insert(gameSystems)
			.values({ ownerId: newOwnerId(), name: "Brass Wardens League" })
			.returning();

		expect(row?.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		expect(row?.createdAt).toBeInstanceOf(Date);
		expect(row?.updatedAt).toBeInstanceOf(Date);
		// Allow for clock skew between this process and the database server.
		expect(row?.createdAt.getTime()).toBeGreaterThan(before - 60_000);
		expect(row?.createdAt.getTime()).toBeLessThan(Date.now() + 60_000);
	});

	it("querying game_systems by owner returns only that owner's rows", async () => {
		const [mine, theirs] = [newOwnerId(), newOwnerId()];
		await db.insert(gameSystems).values([
			{ ownerId: mine, name: "Ironvale Skirmish" },
			{ ownerId: mine, name: "Cinderfall Tactics" },
			{ ownerId: theirs, name: "Gloamreach Wars" },
		]);

		const rows = await db
			.select()
			.from(gameSystems)
			.where(eq(gameSystems.ownerId, mine))
			.orderBy(gameSystems.name);
		expect(rows.map((row) => row.name)).toEqual([
			"Cinderfall Tactics",
			"Ironvale Skirmish",
		]);
		expect(rows.every((row) => row.ownerId === mine)).toBe(true);
	});
});
