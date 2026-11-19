import { z } from "zod";

/**
 * The ONLY module that reads environment variables. Add each variable to this
 * schema and its name to `.env.example`.
 *
 * There is deliberately no parsed module-level `env` singleton: on Cloudflare
 * Workers, bindings arrive per request, and in the browser there is no
 * environment at all, so parsing at import time would crash any module that
 * imports this one. Server code calls `parseEnv` with the runtime's source
 * (the Workers `env` binding, or `process.env` on a Node host) when it needs it.
 */
export const envSchema = z.object({
	// Local tooling, tests and the seed CLI connect with this. On Workers the
	// connection string comes from the Hyperdrive binding instead (F03), so it
	// is optional here. An empty value (`DATABASE_URL=` as in .env.example)
	// counts as unset, so `requireDatabaseUrl` can explain what to do.
	DATABASE_URL: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.url({ protocol: /^postgres(ql)?$/ }).optional(),
	),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
	return envSchema.parse(source);
}

/** `env.DATABASE_URL`, or a helpful error when it isn't set. */
export function requireDatabaseUrl(env: Env): string {
	if (!env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not set. Start Postgres with `pnpm db:up` and copy .env.example to .env (see README).",
		);
	}
	return env.DATABASE_URL;
}
