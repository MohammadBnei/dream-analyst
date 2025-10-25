import postgres from 'postgres'
import { POSTGRES_URL } from '$env/static/private'

const sql = postgres(POSTGRES_URL, { ssl: 'require' })

// The seeding logic for 'profiles' table is removed as it's not relevant to the 'dreams' table
// and should ideally be handled by a dedicated migration or seeding script if needed.

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
