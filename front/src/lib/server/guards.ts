import { error, fail, isRedirect, isHttpError } from '@sveltejs/kit';
import * as v from 'valibot';
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

/**
 * Wraps a form action on /dreams/[id] with the boilerplate all twelve of them
 * repeated: session check, ownership lookup, form parsing, and error mapping.
 *
 * Actions RETURN failures rather than throwing, so this cannot reuse
 * requireOwnedDream (which throws error()) - a thrown error in an action renders
 * the error page instead of giving the form something to display.
 *
 * A handler may still return its own fail() for cases the wrapper cannot know
 * about, such as insufficient credits.
 */
export type DreamActionContext = {
	dream: Dream;
	user: NonNullable<App.Locals['user']>;
	formData: FormData;
};

export function dreamAction<T>(label: string, handler: (ctx: DreamActionContext) => Promise<T>) {
	return async ({
		request,
		params,
		locals
	}: {
		request: Request;
		params: { id: string };
		locals: App.Locals;
	}) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Unauthorized' });

		const dream = await getPrismaClient().dream.findUnique({ where: { id: params.id } });
		// 404 rather than 403: a 403 confirms the id exists to someone who does not
		// own it.
		if (!dream || dream.userId !== user.id) return fail(404, { error: 'Dream not found.' });

		try {
			return await handler({ dream, user, formData: await request.formData() });
		} catch (e) {
			// redirect() and error() signal by throwing. Without this they would be
			// caught here and reported as a 500 - the exact bug this file's callers
			// worked around by inspecting `e.status === 303`.
			if (isRedirect(e) || isHttpError(e)) throw e;
			// Validation messages are ours and safe to show; nothing else is.
			if (v.isValiError(e)) {
				return fail(400, { error: e.issues.map((i) => i.message).join(', ') });
			}
			console.error(`Action ${label} failed for dream ${params.id}:`, e);
			return fail(500, { error: `Failed to ${label}.` });
		}
	};
}
