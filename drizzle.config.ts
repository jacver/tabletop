import { defineConfig } from "drizzle-kit";
import { parseEnv } from "./src/env.ts";

// drizzle-kit doesn't load .env itself. A missing file is fine: CI sets
// DATABASE_URL directly, and `generate` needs no database at all.
try {
	process.loadEnvFile();
} catch {
	// No .env file.
}

const url = parseEnv(process.env).DATABASE_URL;

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema/index.ts",
	out: "./src/db/migrations",
	casing: "snake_case",
	strict: true,
	verbose: true,
	// drizzle-kit's defaults, written out: the test migrator (src/test/db.ts)
	// uses the same table.
	migrations: { schema: "drizzle", table: "__drizzle_migrations" },
	...(url && { dbCredentials: { url } }),
});
