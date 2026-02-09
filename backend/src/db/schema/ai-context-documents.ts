import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * AI Context Documents table — persistent reference materials injected into AI system prompts
 *
 * Admin-managed documents (brand guidelines, tone-of-voice, style guides) that are
 * always included when enabled. Ordered by sortOrder for deterministic prompt injection.
 */
export const aiContextDocuments = pgTable('ai_context_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AIContextDocument = typeof aiContextDocuments.$inferSelect;
export type NewAIContextDocument = typeof aiContextDocuments.$inferInsert;
