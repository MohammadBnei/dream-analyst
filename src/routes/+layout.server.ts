import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {
    return {
        isLoggedIn: !!locals.user
    };
}) satisfies LayoutServerLoad;