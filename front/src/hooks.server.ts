import '$lib/server/logger';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { env } from '$env/dynamic/public';
import { error, redirect } from '@sveltejs/kit';
import { UserRole } from '@prisma/client';
import { getPrismaClient } from '$lib/server/db';
import { consumeRateLimit } from '$lib/server/rateLimit';

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
/**
 * Rate limits. Registration was completely unthrottled while granting credits on
 * every signup, so the cheapest abuse path was: register, create a dream (which
 * runs LLM calls), repeat.
 *
 * Keyed by user id where we have one, IP otherwise. Expensive endpoints are
 * limited per user so one noisy network cannot lock out a shared office.
 */
const RATE_LIMITS: Array<{
	bucket: string;
	match: (pathname: string, method: string) => boolean;
	limit: number;
	windowSeconds: number;
}> = [
	{
		bucket: 'login',
		match: (p, m) => p === '/login' && m === 'POST',
		limit: 10,
		windowSeconds: 900
	},
	{
		bucket: 'register',
		match: (p, m) => p === '/register' && m === 'POST',
		limit: 5,
		windowSeconds: 3600
	},
	{
		bucket: 'transcribe',
		match: (p) => p.startsWith('/api/transcribe'),
		limit: 120,
		windowSeconds: 60
	},
	{
		bucket: 'analysis',
		match: (p) => p.startsWith('/api/dreams/') && p.endsWith('/stream-analysis'),
		limit: 30,
		windowSeconds: 3600
	},
	{
		bucket: 'chat',
		match: (p, m) => p.endsWith('/chat-interpretation') && m === 'POST',
		limit: 60,
		windowSeconds: 3600
	}
];

const handleRateLimit: Handle = async ({ event, resolve }) => {
	const rule = RATE_LIMITS.find((r) => r.match(event.url.pathname, event.request.method));
	if (!rule) return resolve(event);

	const identifier = event.locals.user?.id ?? event.getClientAddress();

	let result;
	try {
		result = await consumeRateLimit(rule.bucket, identifier, rule);
	} catch (e) {
		// Fail OPEN. Redis being unreachable should not make the app unusable;
		// readiness already reports the dependency as down.
		console.error(`Rate limit check failed for ${rule.bucket}, allowing request:`, e);
		return resolve(event);
	}

	if (!result.allowed) {
		return new Response('Too Many Requests', {
			status: 429,
			headers: { 'Retry-After': String(result.retryAfterSeconds) }
		});
	}
	return resolve(event);
};

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

export const handle: Handle = sequence(
	handleParaglide,
	handleAuth,
	handleRateLimit,
	handleRouteGuard,
	handleOrigin
);
