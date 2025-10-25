import postgres from 'postgres'
import { POSTGRES_URL } from '$env/static/private'
import { runMigrations } from '$lib/server/migrate'; // Import the migration runner

const sql = postgres(POSTGRES_URL, { ssl: 'require' })

// The seeding logic for 'profiles' table is removed as it's not relevant to the 'dreams' table
// and should ideally be handled by a dedicated migration or seeding script if needed.

// Run migrations once when the server starts or when this module is first loaded
// This ensures the database schema is up-to-date before any data operations.
// In a production environment, you might want to run migrations as a separate
// deployment step rather than on every app startup, but for development, this is convenient.
runMigrations().catch(error => {
  console.error("Failed to run migrations on startup:", error);
  // Depending on your application's robustness, you might want to
  // exit the process here if migrations are critical for startup.
});


export async function load() {
  const startTime = Date.now()

  try {
    // This now returns an empty array or throws an error if 'profiles' table doesn't exist.
    // The original intent of this file was to demonstrate database interaction.
    // For the 'dreams' table, you would typically have a separate endpoint or service.
    const dreams = await sql`SELECT id, dream_text, created_at FROM dreams LIMIT 10` // Example: fetch some dreams
    const duration = Date.now() - startTime
    return {
      dreams: dreams,
      duration: duration,
    }
  } catch (error) {
    console.error("Error loading data:", error);
    // In a real application, you'd handle this more gracefully,
    // perhaps by checking for specific error types or returning an empty array.
    return {
      dreams: [],
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}
