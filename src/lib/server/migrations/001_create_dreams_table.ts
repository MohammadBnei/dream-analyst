import type { Sql } from 'postgres';

export async function up(sql: Sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

  await sql`
    CREATE TABLE IF NOT EXISTS dreams (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID, -- Assuming user authentication will be added later, can be NOT NULL once users are implemented
      raw_text TEXT NOT NULL,
      analysis_text TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dreams (user_id);
  `;

  console.log('Migration 001_create_dreams_table: "dreams" table created and indexed.');
}

export async function down(sql: Sql) {
  await sql`DROP TABLE IF EXISTS dreams;`;
  console.log('Migration 001_create_dreams_table: "dreams" table dropped.');
}
