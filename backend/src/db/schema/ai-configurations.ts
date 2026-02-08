import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * AI Configurations table — system-wide and per-role AI settings (FR-010)
 *
 * Stores key-value pairs scoped to 'global' or 'role:{roleName}'.
 * One value per scope+key (unique constraint).
 */
export const aiConfigurations = pgTable(
  'ai_configurations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull().default('global'), // 'global' | 'role:{roleName}'
    key: text('key').notNull(), // e.g. 'enabled', 'max_tokens', 'rate_limit'
    value: jsonb('value').notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_config_scope_key_idx').on(table.scope, table.key),
  ]
);

export type AIConfiguration = typeof aiConfigurations.$inferSelect;
export type NewAIConfiguration = typeof aiConfigurations.$inferInsert;
