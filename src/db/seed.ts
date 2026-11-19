import type { Database } from "./client.ts";
import { gameSystems } from "./schema/index.ts";

/** Placeholder owner for sample data until a real dev user exists (F04). */
export const SEED_OWNER_ID = "seed-owner";

/** Invented names only: no real game, publisher or faction names. */
export const SEED_GAME_SYSTEM_NAMES = [
	"Ironvale Skirmish",
	"Gloamreach Wars",
	"Cinderfall Tactics",
] as const;

/**
 * Inserts the sample data. Idempotent: rows that already exist are left
 * alone. Returns how many rows were inserted.
 */
export async function seed(db: Database): Promise<number> {
	const inserted = await db
		.insert(gameSystems)
		.values(
			SEED_GAME_SYSTEM_NAMES.map((name) => ({ ownerId: SEED_OWNER_ID, name })),
		)
		.onConflictDoNothing({ target: [gameSystems.ownerId, gameSystems.name] })
		.returning({ id: gameSystems.id });
	return inserted.length;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Throws unless `url` points at this machine, so a mistyped DATABASE_URL
 * can't seed a shared database. (WHATWG `URL` keeps IPv6 brackets.)
 */
export function assertLocalDatabaseUrl(url: string): void {
	const { hostname } = new URL(url);
	if (!LOCAL_HOSTS.has(hostname)) {
		throw new Error(
			`Refusing to seed "${hostname}": the seed only runs against a local database (localhost, 127.0.0.1 or ::1).`,
		);
	}
}
