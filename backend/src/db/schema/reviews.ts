import { pgTable, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
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
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
