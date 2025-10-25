import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user, // Pass the authenticated user data from locals (set by hooks.server.ts)
  };
};
