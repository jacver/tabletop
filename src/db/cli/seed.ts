// `pnpm db:seed`: seeds the local database. Runs directly under Node's
// TypeScript type stripping, so relative imports carry `.ts`.
import pg from "pg";
import { parseEnv, requireDatabaseUrl } from "../../env.ts";
import { createDb } from "../client.ts";
import { assertLocalDatabaseUrl, seed } from "../seed.ts";

async function main(): Promise<void> {
	const url = requireDatabaseUrl(parseEnv(process.env));
	assertLocalDatabaseUrl(url);
	const pool = new pg.Pool({ connectionString: url });
	try {
		const inserted = await seed(createDb(pool));
		console.log(`Seed complete: ${inserted} row(s) inserted.`);
	} finally {
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
