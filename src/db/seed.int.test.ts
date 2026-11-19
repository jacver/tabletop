import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
	createTempDatabase,
	migrateDatabase,
	type TempDatabase,
	withDatabase,
} from "../test/db.ts";
import { gameSystems } from "./schema/index.ts";
import { SEED_GAME_SYSTEM_NAMES, SEED_OWNER_ID, seed } from "./seed.ts";

// The seed owns fixed rows, so it runs against its own empty database rather
// than the shared, owner-scoped one.
let database: TempDatabase;

beforeAll(async () => {
	database = await createTempDatabase(inject("testDatabaseUrl"));
	await migrateDatabase(database.url);
});

afterAll(async () => {
	await database?.drop();
});

function seededNames(): Promise<string[]> {
	return withDatabase(database.url, async (db) => {
		const rows = await db
			.select({ name: gameSystems.name })
			.from(gameSystems)
			.where(eq(gameSystems.ownerId, SEED_OWNER_ID))
			.orderBy(gameSystems.name);
		return rows.map((row) => row.name);
	});
}

describe("seed", () => {
	it("seed inserts the sample game systems for the seed owner", async () => {
		const inserted = await withDatabase(database.url, seed);
		expect(inserted).toBe(SEED_GAME_SYSTEM_NAMES.length);
		expect(await seededNames()).toEqual([...SEED_GAME_SYSTEM_NAMES].sort());
	});

	it("seed is idempotent when run twice", async () => {
		await withDatabase(database.url, seed);
		const before = await seededNames();
		const insertedAgain = await withDatabase(database.url, seed);
		expect(insertedAgain).toBe(0);
		expect(await seededNames()).toEqual(before);
		expect(before).toHaveLength(SEED_GAME_SYSTEM_NAMES.length);
	});
});
