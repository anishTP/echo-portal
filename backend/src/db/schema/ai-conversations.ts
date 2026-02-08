import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { branches } from './branches.js';

/**
 * AI Conversations table - tracks multi-turn conversation sessions
 * Scoped to a user + branch + session (FR-015, FR-016)
 *
 * One active conversation per user per branch (FR-017).
 * Conversation context is cleared on session end or branch switch (FR-016).
 */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    sessionId: text('session_id').notNull(),
    status: text('status').notNull().default('active'),
    turnCount: integer('turn_count').notNull().default(0),
    maxTurns: integer('max_turns').notNull().default(20),
    endReason: text('end_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('ai_conv_user_branch_idx').on(table.userId, table.branchId),
    index('ai_conv_session_idx').on(table.sessionId),
    index('ai_conv_expires_idx').on(table.expiresAt),
    // Partial unique: one active conversation per user per branch
    uniqueIndex('ai_conv_active_unique')
      .on(table.userId, table.branchId)
      .where(sql`${table.status} = 'active'`),
  ]
);

export type AIConversation = typeof aiConversations.$inferSelect;
export type NewAIConversation = typeof aiConversations.$inferInsert;
