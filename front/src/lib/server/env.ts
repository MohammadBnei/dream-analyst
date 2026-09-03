import { env } from '$env/dynamic/private';
import * as v from 'valibot';

/**
 * One place that knows what this server needs from the environment.
 *
 * Before this, 16 variables were read across 10 modules in five different
 * styles: module-scope throws, constructor throws, `if (!x) throw` repeated
 * three times for REDIS_URL, a silent `parseInt(x || 'default')` that yielded
 * NaN limits on a typo, and `${env.DATABASE_URL}` in db/index.ts, which
 * produced the literal string "undefined" and handed it to the driver.
 *
 * Validated LAZILY, never at module import. See the comment on jwtSecret() in
 * auth.ts: a module-scope throw also fires during `vite build`, which evaluates
 * server modules, so requiring configuration at import time breaks the image
 * build instead of reporting a misconfigured deployment. Failing on first use is
 * just as loud at runtime and keeps "cannot build" separate from "is not
 * configured".
 */

/** Whole positive integer from a string, so a typo fails loudly instead of NaN. */
const count = (fallback: number) =>
	v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => Number(s)),
			v.number('must be a number'),
			v.integer('must be a whole number'),
			v.minValue(0, 'must not be negative')
		),
		String(fallback)
	);

const nonEmpty = (name: string) => v.pipe(v.string(`${name} is required`), v.minLength(1));

const ServerEnvSchema = v.object({
	DATABASE_URL: nonEmpty('DATABASE_URL'),
	REDIS_URL: nonEmpty('REDIS_URL'),
	OPENROUTER_API_KEY: nonEmpty('OPENROUTER_API_KEY'),

	// Configurable so the streaming path can be exercised against a local stub;
	// the default is the only value production should ever use.
	OPENROUTER_BASE_URL: v.optional(v.string(), 'https://openrouter.ai/api/v1'),
	OPENROUTER_MODEL_NAME: v.optional(v.string(), 'mistralai/mistral-7b-instruct-v0.2'),
	OPENROUTER_WEAK_MODEL: v.optional(v.string(), 'meta-llama/llama-3.1-70b-instruct'),
	ORIGIN: v.optional(v.string(), ''),

	STT_ADDR: v.optional(v.string(), 'http://ukubi-stt.ukubi-stt.svc.cluster.local:9090'),
	STT_TOKEN_DREAMER: v.optional(v.string(), ''),

	// Rate limits, configurable because the right value depends on deployment
	// shape. The originals (5 registrations/hour per IP) were tight enough to
	// block a household or office behind one NAT - and tight enough that the e2e
	// suite throttled itself.
	RATE_LIMIT_REGISTER_PER_HOUR: count(20),
	RATE_LIMIT_LOGIN_PER_15MIN: count(20),

	CREDIT_COST_DREAM_ANALYSIS: count(2),
	CREDIT_COST_CHAT_MESSAGE: count(1),
	DAILY_LIMIT_BASIC: count(10),
	DAILY_LIMIT_VIP: count(50),
	DAILY_LIMIT_ADMIN: count(999999)
});

export type ServerEnv = v.InferOutput<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/** Throws with every offending variable named, not just the first. */
export function serverEnv(): ServerEnv {
	if (cached) return cached;
	const result = v.safeParse(ServerEnvSchema, env);
	if (!result.success) {
		const problems = result.issues
			.map((i) => `${i.path?.map((p) => String(p.key)).join('.') ?? '(root)'}: ${i.message}`)
			.join('; ');
		throw new Error(`Invalid server environment - ${problems}. See .env.example.`);
	}
	cached = result.output;
	return cached;
}

/** Test seam: forget the cached parse. */
export function resetServerEnvCache() {
	cached = undefined;
}
