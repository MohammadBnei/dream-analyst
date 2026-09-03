import '$lib/server/logger';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { env } from '$env/dynamic/public';
import { error, redirect } from '@sveltejs/kit';
import { UserRole } from '@prisma/client';
import { getPrismaClient } from '$lib/server/db';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

/** Requests that can never need a session; skips a DB round-trip per asset. */
const isInternalAsset = (pathname: string) =>
	pathname.startsWith('/_app/') || pathname === '/favicon.ico' || pathname === '/healthz';

const handleAuth: Handle = async ({ event, resolve }) => {
	const authToken = event.cookies.get(auth.authTokenCookieName);

	if (!authToken || isInternalAsset(event.url.pathname)) {
		event.locals.user = undefined;
		return resolve(event);
	}

	const decodedToken = auth.verifyToken(authToken);

	if (!decodedToken?.userId) {
		auth.deleteAuthTokenCookie(event.cookies);
		event.locals.user = undefined;
		return resolve(event);
	}

	// Read the user from the database rather than trusting the token payload.
	// The JWT lasts 30 days and there is no revocation, so a role changed in
	// /admin, or a deleted account, previously stayed in force until expiry -
	// a demoted admin kept admin rights for up to a month.
	const user = await getPrismaClient().user.findUnique({
		where: { id: decodedToken.userId },
		select: { id: true, username: true, email: true, role: true }
	});

	if (!user) {
		auth.deleteAuthTokenCookie(event.cookies);
		event.locals.user = undefined;
		return resolve(event);
	}

	event.locals.user = user;
	return resolve(event);
};

/**
 * Route-level authentication. Ownership is per-resource and cannot live here;
 * see requireOwnedDream in $lib/server/guards.
 *
 * /dreams/new previously had no load function at all, so an anonymous visitor
 * got the full form and only discovered the problem on submit.
 */
const PROTECTED_PAGES = ['/dreams', '/profile', '/admin'];
const PROTECTED_APIS = ['/api/dreams', '/api/transcribe'];

const handleRouteGuard: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (!event.locals.user) {
		// APIs answer 401; pages redirect so the browser lands somewhere useful.
		if (PROTECTED_APIS.some((p) => pathname.startsWith(p))) error(401, 'Unauthorized');
		if (PROTECTED_PAGES.some((p) => pathname.startsWith(p))) {
			redirect(302, `/login?redirectTo=${encodeURIComponent(pathname)}`);
		}
		return resolve(event);
	}

	// Matches what admin/+page.server.ts already did, so non-admins keep landing
	// on the home page rather than seeing an error screen.
	if (pathname.startsWith('/admin') && event.locals.user.role !== UserRole.ADMIN) {
		redirect(302, '/');
	}

	return resolve(event);
};

export const handleOrigin: Handle = async ({ event, resolve }) => {
	const publicOrigin = env.PUBLIC_ORIGIN || event.url.origin; // From env var or ingress host
	event.url = new URL(event.url.pathname + event.url.search, publicOrigin);

	return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleAuth, handleRouteGuard, handleOrigin);
