import { pgTable, uuid, text, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
	id: uuid('id').primaryKey().defaultRandom(), // Changed to uuid and defaultRandom
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: uuid('user_id') // Changed to uuid
		.notNull()
		.references(() => user.id),
	expiresAt: timestamp('expires_at', {
		withTimezone: true,
		mode: 'date'
	}).notNull()
});

export const dream = pgTable('dreams', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id') // Changed to uuid
		.references(() => user.id), // Can be null initially, then NOT NULL once users are fully integrated
	rawText: text('raw_text').notNull(),
	analysisText: text('analysis_text'),
	interpretation: text('interpretation'), // Added from 005_add_interpretation_to_dreams_table
	status: varchar('status', { length: 50 }).notNull().default('pending_analysis'), // Added from 003_add_status_to_dreams_table
	tags: jsonb('tags'), // Added from 004_add_tags_to_dreams_table
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Export types for convenience
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Dream = typeof dream.$inferSelect;
export type NewDream = typeof dream.$inferInsert;
