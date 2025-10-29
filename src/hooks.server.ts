import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getPrismaClient } from '$lib/server/db';
const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

const handleAuth: Handle = async ({ event, resolve }) => {
	const authToken = event.cookies.get(auth.authTokenCookieName);

	if (!authToken) {
		event.locals.user = undefined; // Set to undefined as per app.d.ts
		return resolve(event);
	}

	const decodedToken = auth.verifyToken(authToken);

	if (decodedToken && decodedToken.userId) {
		// We can directly use the username and email from the decoded token
		// if we trust the token to contain up-to-date user information.
		// If not, we would fetch the user from the DB using decodedToken.userId
		// For now, let's fetch from DB to ensure data consistency.
		const user = await prisma.user.findUnique({
			where: { id: decodedToken.userId }
		});
		if (user) {
			event.locals.user = {
				id: user.id,
				username: user.username,
				email: user.email
			};
		} else {
			// User not found in DB, token might be valid but user deleted
			auth.deleteAuthTokenCookie(event.cookies);
			event.locals.user = undefined;
		}
	} else {
		// Token is invalid or expired
		auth.deleteAuthTokenCookie(event.cookies);
		event.locals.user = undefined;
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleAuth);
