// src/hooks.server.ts
import { runMigrations } from '$lib/server/migrate';
import { verifyToken } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

// Flag to ensure migrations run only once on server startup
let migrationsRun = false;

export const handle: Handle = async ({ event, resolve }) => {
  // Run migrations once on server startup
  if (!migrationsRun) {
    console.log('Attempting to run migrations...');
    await runMigrations();
    migrationsRun = true;
  }

  // Authentication logic: Verify JWT and set locals.user
  const token = event.cookies.get('jwt');
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      // Set user data in locals (minimal for now; expand if needed)
      event.locals.user = { id: decoded.userId };
    }
  }

  const response = await resolve(event);
  return response;
};
