import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, request }) => {
	const acceptLanguageHeader = request.headers.get('Accept-Language');
	const lang = acceptLanguageHeader && acceptLanguageHeader.startsWith('fr') ? 'fr' : 'en';

	return {
		isLoggedIn: !!locals.user,
		isAdmin: locals.user?.role === 'ADMIN',
		lang: lang
	};
}) satisfies LayoutServerLoad;
