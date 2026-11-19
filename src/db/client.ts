import { drizzle } from "drizzle-orm/node-postgres";
import type { Client, Pool } from "pg";
import * as schema from "./schema/index.ts";

/**
 * A typed Drizzle instance over a pg `Pool` (Node host, tests, tooling) or a
 * per-request `Client` (Workers over Hyperdrive, F03). The caller owns the
 * connection; this module opens none and reads no environment.
 */
export function createDb(client: Pool | Client) {
	return drizzle({ client, schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;
