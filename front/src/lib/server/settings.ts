import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '$lib/server/db';
import { serverEnv } from '$lib/server/env';

/**
 * Runtime-tunable settings, so a model can be swapped without a deploy.
 *
 * Deliberately NOT part of env.ts. That module validates configuration the
 * process cannot start without, once, lazily. These are values an operator
 * changes while the process is running, and a missing row is not an error - it
 * means "use the environment default".
 *
 * Reads FAIL OPEN to the environment. Same reasoning as rate limiting failing
 * open when Redis is down: a database blip must degrade to the configured
 * default, never stop an analysis.
 *
 * ponytail: in-process cache, no invalidation across processes. A change takes
 * up to SETTINGS_TTL_MS to take effect, and a second replica would cache
 * independently. That is fine while the deploy is single-replica (the same
 * constraint `activeStreamProcessors` already lives under). Upgrade path when a
 * second replica arrives: publish an invalidation message on the Redis channel
 * streamStateStore already owns, and clear the cache on receipt.
 */

/** Long enough that a hot path never queries, short enough to feel live. */
const SETTINGS_TTL_MS = 30_000;

/**
 * The keys that mean something today. Values map onto env fallbacks, which is
 * the only reason this is a union and not an open string - a typo'd key would
 * otherwise silently read as "unset" forever.
 */
export const SETTING_KEYS = {
	/** Writes the dream interpretation. */
	MODEL_STRONG: 'openrouter.model.strong',
	/** Titles and search keywords. Cheap, high volume. */
	MODEL_WEAK: 'openrouter.model.weak',
	/**
	 * Canonicalises extracted dream elements against the user's vocabulary.
	 *
	 * Deliberately NOT the weak model. The step-0 spike had llama-3.1-70b fusing
	 * the dreamer's mother into her grandmother and filing `avion` under `mer`,
	 * across two prompt rewrites and two candidate-format changes. A wrong merge
	 * is permanent and shows someone a symbol they never dreamt, so this defaults
	 * to a rule-following model instead.
	 */
	/** Element extraction. See OPENROUTER_EXTRACTOR_MODEL. */
	MODEL_EXTRACTOR: 'openrouter.model.extractor',
	MODEL_MATCHER: 'openrouter.model.matcher'
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

let cache: Map<string, string> | undefined;
let loadedAt = 0;

async function load(prisma: PrismaClient): Promise<Map<string, string>> {
	if (cache && Date.now() - loadedAt < SETTINGS_TTL_MS) return cache;
	try {
		const rows = await prisma.appSetting.findMany();
		cache = new Map(rows.map((r) => [r.key, r.value]));
		loadedAt = Date.now();
	} catch (e) {
		// Fail open: keep whatever we had, and if we had nothing, an empty map
		// means every getSetting() call returns its env fallback.
		console.warn('settings: read failed, falling back to environment', e);
		cache ??= new Map();
		loadedAt = Date.now();
	}
	return cache;
}

/** The database value for `key`, or `fallback` when no row exists. */
export async function getSetting(
	key: SettingKey,
	fallback: string,
	prisma: PrismaClient = getPrismaClient()
): Promise<string> {
	const value = (await load(prisma)).get(key);
	return value && value.trim() ? value.trim() : fallback;
}

/** The model that writes interpretations. */
export function strongModel(prisma?: PrismaClient): Promise<string> {
	return getSetting(SETTING_KEYS.MODEL_STRONG, serverEnv().OPENROUTER_MODEL_NAME, prisma);
}

/** The model behind titles and keyword extraction. */
export function weakModel(prisma?: PrismaClient): Promise<string> {
	return getSetting(SETTING_KEYS.MODEL_WEAK, serverEnv().OPENROUTER_WEAK_MODEL, prisma);
}

/** The model that names the elements in a dream. */
export function extractorModel(prisma?: PrismaClient): Promise<string> {
	return getSetting(SETTING_KEYS.MODEL_EXTRACTOR, serverEnv().OPENROUTER_EXTRACTOR_MODEL, prisma);
}

/** The model that canonicalises vocabulary. See MODEL_MATCHER. */
export function matcherModel(prisma?: PrismaClient): Promise<string> {
	return getSetting(SETTING_KEYS.MODEL_MATCHER, serverEnv().OPENROUTER_MATCHER_MODEL, prisma);
}
