import type { TestProject } from "vitest/node";
import { parseEnv, requireDatabaseUrl } from "../env.ts";
import { createTempDatabase, migrateDatabase } from "./db.ts";

declare module "vitest" {
	export interface ProvidedContext {
		testDatabaseUrl: string;
	}
}

/**
 * Global setup for the `integration` project: creates a fresh, migrated
 * database for this run, provides its URL to the test files, and drops it
 * afterwards. The dev database is never touched. Fails loudly (never skips)
 * when DATABASE_URL is missing.
 */
export default async function setup(project: TestProject) {
	try {
		process.loadEnvFile();
	} catch {
		// No .env file: DATABASE_URL may come from the environment (CI).
	}
	const serverUrl = requireDatabaseUrl(parseEnv(process.env));
	const database = await createTempDatabase(serverUrl);
	try {
		await migrateDatabase(database.url);
	} catch (error) {
		await database.drop();
		throw error;
	}
	project.provide("testDatabaseUrl", database.url);
	return () => database.drop();
}
