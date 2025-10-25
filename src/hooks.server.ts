// src/hooks.server.ts
import { runMigrations } from '$lib/server/migrate';
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

  // TODO: Authentication logic will go here in a later step
  // For now, just resolve the request
  const response = await resolve(event);
  return response;
};
