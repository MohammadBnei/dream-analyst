import postgres, { type Sql } from 'postgres';
import { env } from '$env/dynamic/private';

// Ensure DATABASE_URL is set in your .env file
const DATABASE_URL = env.DATABASE_URL || 'postgres://user:password@host:port/database';

// Initialize the PostgreSQL client
export const sql: Sql = postgres(DATABASE_URL, {
  // Optional: Add connection options here
  // For example, to disable SSL in development if your local DB doesn't use it:
  // ssl: process.env.NODE_ENV === 'production',
});

console.log('Database connection initialized.');

process.on('SIGINT', async () => {
  console.log('Closing database connection...');
  await sql.end();
  process.exit(0);
});
