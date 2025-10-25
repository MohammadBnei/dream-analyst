import { up as migrate001Up } from './migrations/001_create_dreams_table';
import { up as migrate002Up } from './migrations/002_create_users_table';
import { sql } from './db';

async function runMigrations() {
  console.log('Starting database migrations...');
  try {
    // Create a migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Migrations table ensured.');

    const appliedMigrations = await sql`SELECT name FROM migrations`;
    const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));

    const migrationsToRun = [
      { name: '001_create_dreams_table', up: migrate001Up },
      { name: '002_create_users_table', up: migrate002Up },
    ];

    for (const migration of migrationsToRun) {
      if (!appliedMigrationNames.has(migration.name)) {
        console.log(`Applying migration: ${migration.name}`);
        await migration.up(sql);
        await sql`INSERT INTO migrations (name) VALUES (${migration.name})`;
        console.log(`Migration ${migration.name} applied successfully.`);
      } else {
        console.log(`Migration ${migration.name} already applied. Skipping.`);
      }
    }

    console.log('All migrations checked and applied if necessary.');
  } catch (error) {
    console.error('Error during migrations:', error);
    process.exit(1); // Exit with an error code
  } finally {
    await sql.end(); // Close the database connection
  }
}

// If this script is run directly, execute the migrations
// This part is typically for running migrations as a standalone script, e.g., `node migrate.js`
// For SvelteKit, it's more common to import and call runMigrations from a server hook or load function.
// if (require.main === module) {
//   runMigrations();
// }

// Export the function so it can be called from other parts of the application
export { runMigrations };
