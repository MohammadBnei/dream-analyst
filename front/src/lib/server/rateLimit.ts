import { getRedisPublisher } from '$lib/server/streamStateStore';

/**
 * Fixed-window rate limiting backed by Redis.
 *
 * Redis rather than an in-process Map on purpose: an in-process counter is a
 * correctness argument that silently depends on running exactly one pod, and
 * this deployment's replica count is not pinned anywhere in helm.
 *
 * Fixed window, not sliding: a client can send up to 2x the limit across a window
 * boundary. That is a known and accepted ceiling for login/registration
 * throttling, and it costs one INCR instead of a sorted set per request.
 * ponytail: move to a sliding window only if boundary bursts become a real problem.
 */
export type RateLimitRule = { limit: number; windowSeconds: number };

export type RateLimitResult = {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
};

export async function consumeRateLimit(
	bucket: string,
	identifier: string,
	rule: RateLimitRule
): Promise<RateLimitResult> {
	const redis = getRedisPublisher();
	const key = `ratelimit:${bucket}:${identifier}`;

	// INCR then EXPIRE only on first hit, so the window starts with the first
	// request and is not extended by later ones.
	const count = await redis.incr(key);
	if (count === 1) await redis.expire(key, rule.windowSeconds);

	if (count > rule.limit) {
		const ttl = await redis.ttl(key);
		return {
			allowed: false,
			remaining: 0,
			retryAfterSeconds: ttl > 0 ? ttl : rule.windowSeconds
		};
	}

	return { allowed: true, remaining: rule.limit - count, retryAfterSeconds: 0 };
}
