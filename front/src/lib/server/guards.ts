import { error } from '@sveltejs/kit';
import type { Dream } from '@prisma/client';
import { getPrismaClient } from '$lib/server/db';

/**
 * Authentication and per-resource authorization, in one place.
 *
 * These replace `getCurrentUser(locals)` - six identical lines copy-pasted into
 * eight route files - and roughly twenty repetitions of
 * `if (!dream || dream.userId !== user.id)`.
 *
 * Authentication itself happens in hooks.server.ts. requireUser is the assertion
 * a handler makes about its own preconditions.
 */
export function requireUser(locals: App.Locals) {
	if (!locals.user) error(401, 'Unauthorized');
	return locals.user;
}

/**
 * Returns the dream, so callers stop re-fetching what they just checked.
 *
 * Answers 404 - not 403 - for a dream owned by someone else. A 403 confirms to a
 * stranger that the id exists, which is a membership oracle over every dream id.
 */
export async function requireOwnedDream(locals: App.Locals, dreamId: string): Promise<Dream> {
	const user = requireUser(locals);
	const dream = await getPrismaClient().dream.findUnique({ where: { id: dreamId } });
	if (!dream || dream.userId !== user.id) error(404, 'Dream not found.');
	return dream;
}
