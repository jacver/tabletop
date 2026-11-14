import { z } from "zod";

/**
 * The ONLY module that reads environment variables. Add each variable to this
 * schema and its name to `.env.example`. Empty until a feature needs one.
 */
export const envSchema = z.object({});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
	return envSchema.parse(source);
}

export const env: Env = parseEnv(
	typeof process === "undefined" ? {} : process.env,
);
