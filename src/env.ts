import { z } from "zod";

/**
 * The ONLY module that reads environment variables. Add each variable to this
 * schema and its name to `.env.example`. Empty until a feature needs one.
 *
 * There is deliberately no parsed module-level `env` singleton: on Cloudflare
 * Workers, bindings arrive per request, and in the browser there is no
 * environment at all, so parsing at import time would crash any module that
 * imports this one. Server code calls `parseEnv` with the runtime's source
 * (the Workers `env` binding, or `process.env` on a Node host) when it needs it.
 */
export const envSchema = z.object({});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
	return envSchema.parse(source);
}
