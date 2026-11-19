import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, inject } from "vitest";
import { createDb, type Database } from "../db/client.ts";

/**
 * Integration-test helpers. Tests that touch Postgres are `*.int.test.ts`
 * and run in the `integration` Vitest project, whose global setup creates a
 * fresh database per run and provides its URL as `testDatabaseUrl`.
 */

// Same values as `migrations` in drizzle.config.ts, so the programmatic
// migrator and `pnpm db:migrate` record migrations in the same table.
export const migrationsConfig = {
	migrationsFolder: "src/db/migrations",
	migrationsSchema: "drizzle",
	migrationsTable: "__drizzle_migrations",
} as const;

/** One pool per test file on the run's test database, closed after the file. */
export function testDb(): Database {
	const pool = new pg.Pool({ connectionString: inject("testDatabaseUrl") });
	afterAll(() => pool.end());
	return createDb(pool);
}

/** A fresh owner id, so each test's rows are its own. */
export function newOwnerId(): string {
	return crypto.randomUUID();
}

export type TempDatabase = { url: string; drop: () => Promise<void> };

/**
 * Creates an empty database on the server `serverUrl` points at (any
 * database on it works; only `CREATE DATABASE` runs there) and returns its
 * URL and a `drop` that removes it.
 */
export async function createTempDatabase(
	serverUrl: string,
): Promise<TempDatabase> {
	const name = `tabletop_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
	await withClient(serverUrl, (client) =>
		client.query(`CREATE DATABASE "${name}"`),
	);
	const url = new URL(serverUrl);
	url.pathname = `/${name}`;
	return {
		url: url.toString(),
		drop: () =>
			withClient(serverUrl, async (client) => {
				await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
			}),
	};
}

/** Applies every migration in `src/db/migrations` to the database at `url`. */
export async function migrateDatabase(url: string): Promise<void> {
	const pool = new pg.Pool({ connectionString: url });
	try {
		await migrate(drizzle({ client: pool }), migrationsConfig);
	} finally {
		await pool.end();
	}
}

/** Runs `fn` with a database handle on `url`, then closes the connection. */
export async function withDatabase<T>(
	url: string,
	fn: (db: Database) => Promise<T>,
): Promise<T> {
	const pool = new pg.Pool({ connectionString: url });
	try {
		return await fn(createDb(pool));
	} finally {
		await pool.end();
	}
}

/** The entries of drizzle-kit's migration journal (one per migration). */
export function readMigrationJournal(): { tag: string }[] {
	const journal: { entries: { tag: string }[] } = JSON.parse(
		readFileSync(
			`${migrationsConfig.migrationsFolder}/meta/_journal.json`,
			"utf8",
		),
	);
	return journal.entries;
}

async function withClient<T>(
	url: string,
	fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}
