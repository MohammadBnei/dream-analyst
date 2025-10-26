import type { Sql } from 'postgres';

export async function up(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    ADD COLUMN status VARCHAR(50) DEFAULT 'pending_analysis' NOT NULL;
  `;
  console.log('Migration 003_add_status_to_dreams_table: "status" column added to "dreams" table.');
}

export async function down(sql: Sql) {
  await sql`
    ALTER TABLE dreams
    DROP COLUMN status;
  `;
  console.log('Migration 003_add_status_to_dreams_table: "status" column dropped from "dreams" table.');
}
