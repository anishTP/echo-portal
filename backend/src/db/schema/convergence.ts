import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { convergenceStatusEnum } from './enums.js';
import { branches } from './branches.js';
import { users } from './users.js';

export const convergenceOperations = pgTable('convergence_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  publisherId: uuid('publisher_id')
    .references(() => users.id)
    .notNull(),
  status: convergenceStatusEnum('status').default('pending').notNull(),
  validationResults: jsonb('validation_results').default([]).notNull(),
  conflictDetected: boolean('conflict_detected').default(false).notNull(),
  conflictDetails: jsonb('conflict_details'),
  mergeCommit: text('merge_commit'),
  targetRef: text('target_ref').default('main').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('convergence_branch_id_idx').on(table.branchId),
  index('convergence_status_idx').on(table.status),
  index('convergence_publisher_id_idx').on(table.publisherId),
]);

export type ConvergenceOperation = typeof convergenceOperations.$inferSelect;
export type NewConvergenceOperation = typeof convergenceOperations.$inferInsert;
