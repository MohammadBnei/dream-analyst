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
		event.locals.user = {
			id: decodedToken.userId,
			username: decodedToken.username,
			email: decodedToken.email,
			role: decodedToken.role
		};
	} else {
		// Token is invalid or expired
		auth.deleteAuthTokenCookie(event.cookies);
		event.locals.user = undefined;
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleAuth);
