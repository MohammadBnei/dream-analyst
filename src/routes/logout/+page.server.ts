// src/routes/logout/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ cookies }) => {
    cookies.delete('jwt', { path: '/' });
    throw redirect(303, '/'); // Redirect to home page after logout
  }
};
