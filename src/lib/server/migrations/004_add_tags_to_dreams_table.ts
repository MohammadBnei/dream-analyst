// src/lib/server/migrations/004_add_tags_to_dreams_table.ts
import type { Sql } from 'postgres';

export async function up(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    ADD COLUMN tags JSONB;
  `;
  console.log('Migration 004_add_tags_to_dreams_table: "tags" column added to "dreams" table.');
}

export async function down(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    DROP COLUMN tags;
  `;
  console.log('Migration 004_add_tags_to_dreams_table: "tags" column dropped from "dreams" table.');
}
