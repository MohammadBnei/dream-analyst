import { error } from '@sveltejs/kit';

/**
 * Ensures the user is authenticated by checking locals.user.
 * Throws a 401 Unauthorized error if the user is not authenticated.
 *
 * @param locals - The App.Locals object from SvelteKit request
 * @returns The authenticated user object
 * @throws 401 Unauthorized error if user is not authenticated
 */
export function requireUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return locals.user;
}
