import { json } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { getRedisPublisher } from '$lib/server/streamStateStore';

/**
 * Readiness: can this pod actually serve traffic?
 *
 * Deliberately separate from /healthz. helm previously pointed BOTH the liveness
 * and readiness probes at /healthz, which returned {status:'ok'} unconditionally
 * without touching anything - so a pod with no DATABASE_URL, REDIS_URL,
 * OPENROUTER_API_KEY or JWT_SECRET passed both probes and served errors to users.
 *
 * The dependency checks must NOT be on the liveness probe: a transient Redis or
 * Postgres blip would then restart the pod and destroy every in-flight analysis,
 * turning a brief dependency wobble into lost work. Liveness stays /healthz
 * (the process is running); readiness is here (its dependencies answer).
 */
export async function GET() {
	const checks: Record<string, 'ok' | string> = {};

	await Promise.all([
		(async () => {
			try {
				await getPrismaClient().$queryRaw`SELECT 1`;
				checks.postgres = 'ok';
			} catch (e) {
				checks.postgres = e instanceof Error ? e.message : 'unreachable';
			}
		})(),
		(async () => {
			try {
				await getRedisPublisher().ping();
				checks.redis = 'ok';
			} catch (e) {
				checks.redis = e instanceof Error ? e.message : 'unreachable';
			}
		})()
	]);

	const ready = Object.values(checks).every((v) => v === 'ok');
	return json({ status: ready ? 'ready' : 'not ready', checks }, { status: ready ? 200 : 503 });
}
