// src/lib/server/migrations/005_add_interpretation_to_dreams_table.ts
import type { Sql } from 'postgres';

export async function up(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    ADD COLUMN interpretation TEXT;
  `;
  console.log('Migration 005_add_interpretation_to_dreams_table: "interpretation" column added to "dreams" table.');
}

export async function down(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    DROP COLUMN interpretation;
  `;
  console.log('Migration 005_add_interpretation_to_dreams_table: "interpretation" column dropped from "dreams" table.');
}
