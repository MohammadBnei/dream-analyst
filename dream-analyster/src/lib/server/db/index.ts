import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema'; // Ensure all schema objects are imported
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL);

// The schema object passed to drizzle should only contain the tables that are part of the current schema.
// Since 'session' table is removed, it should not be referenced here.
export const db = drizzle(client, { schema });
