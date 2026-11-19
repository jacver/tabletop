import { sql } from "drizzle-orm";
import { describe, expect, inject, it } from "vitest";
import {
	createTempDatabase,
	migrateDatabase,
	readMigrationJournal,
	type TempDatabase,
	withDatabase,
} from "../test/db.ts";

async function withEmptyDatabase(
	fn: (database: TempDatabase) => Promise<void>,
): Promise<void> {
	const database = await createTempDatabase(inject("testDatabaseUrl"));
	try {
		await fn(database);
	} finally {
		await database.drop();
	}
}

function appliedMigrationCount(url: string): Promise<number> {
	return withDatabase(url, async (db) => {
		const result = await db.execute<{ count: number }>(
			sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
		);
		return result.rows[0]?.count ?? -1;
	});
}

describe("migrations", () => {
	it("migrations apply cleanly to an empty database", async () => {
		await withEmptyDatabase(async ({ url }) => {
			await migrateDatabase(url);

			const table = await withDatabase(url, (db) =>
				db.execute<{ name: string | null }>(
					sql`select to_regclass('public.game_systems')::text as name`,
				),
			);
			expect(table.rows[0]?.name).toBe("game_systems");

			const journal = readMigrationJournal();
			expect(journal.length).toBeGreaterThan(0);
			expect(await appliedMigrationCount(url)).toBe(journal.length);
		});
	});

	it("running migrations twice is a no-op", async () => {
		await withEmptyDatabase(async ({ url }) => {
			await migrateDatabase(url);
			await expect(migrateDatabase(url)).resolves.toBeUndefined();
			expect(await appliedMigrationCount(url)).toBe(
				readMigrationJournal().length,
			);
		});
	});
});
