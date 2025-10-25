// src/routes/logout/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ cookies }) => {
    cookies.delete('jwt', { path: '/' });
    throw redirect(303, '/login'); // Redirect to login page after logout
  }
};
