import { json } from '@sveltejs/kit';

/**
 * Liveness only: the process is up and serving. Intentionally checks nothing
 * else - see /readyz for dependency checks, and the comment there for why they
 * must not be attached to the liveness probe.
 */
export function GET() {
	return json({ status: 'ok' }, { status: 200 });
}
