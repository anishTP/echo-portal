import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { branches } from './branches.js';
import { contents } from './contents.js';
import { aiConversations } from './ai-conversations.js';

/**
 * AI Requests table - individual generation/transformation requests
 * Ephemeral: cleaned up on session end via expiresAt TTL (FR-018)
 *
 * One pending/generating request per user per branch at a time (FR-017).
 * Stores generated content server-side for audit of rejected content (FR-005).
 */
export const aiRequests = pgTable(
  'ai_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    contentId: uuid('content_id').references(() => contents.id),
    requestType: text('request_type').notNull(), // 'generation' | 'transformation'
    prompt: text('prompt').notNull(),
    selectedText: text('selected_text'),
    contextSnapshot: text('context_snapshot'),
    generatedContent: text('generated_content'),
    status: text('status').notNull().default('generating'), // generating|pending|accepted|rejected|cancelled|discarded
    providerId: text('provider_id'),
    modelId: text('model_id'),
    tokensUsed: integer('tokens_used'),
    errorMessage: text('error_message'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    responseMode: text('response_mode'), // 'add' | 'replace' | 'analyse'
    resolvedBy: text('resolved_by'), // 'user' | 'system'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('ai_req_conversation_idx').on(table.conversationId),
    index('ai_req_user_branch_status_idx').on(table.userId, table.branchId, table.status),
    index('ai_req_expires_idx').on(table.expiresAt),
    index('ai_req_rate_limit_idx').on(table.userId, table.createdAt),
  ]
);

export type AIRequest = typeof aiRequests.$inferSelect;
export type NewAIRequest = typeof aiRequests.$inferInsert;
