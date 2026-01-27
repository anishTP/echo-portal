import { pgTable, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { reviewStatusEnum, reviewDecisionEnum } from './enums.js';
import { branches } from './branches.js';
import { users } from './users.js';

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  reviewerId: uuid('reviewer_id')
    .references(() => users.id)
    .notNull(),
  requestedById: uuid('requested_by_id')
    .references(() => users.id)
    .notNull(),
  status: reviewStatusEnum('status').default('pending').notNull(),
  decision: reviewDecisionEnum('decision'),
  comments: jsonb('comments').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('reviews_branch_id_idx').on(table.branchId),
  index('reviews_reviewer_id_idx').on(table.reviewerId),
  index('reviews_status_idx').on(table.status),
  index('reviews_reviewer_status_idx').on(table.reviewerId, table.status),
]);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
