import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { reviews } from './reviews.js';
import { branches } from './branches.js';
import type { SnapshotData } from '@echo-portal/shared';

/**
 * Review snapshots table - captures comparison state at review submission time
 *
 * Per FR-003: Comparison snapshots preserve the exact state at submission time
 * for audit compliance. Snapshots are immutable once created.
 */
export const reviewSnapshots = pgTable('review_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .unique()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'cascade' }),
  baseCommit: varchar('base_commit', { length: 40 }).notNull(),
  headCommit: varchar('head_commit', { length: 40 }).notNull(),
  snapshotData: jsonb('snapshot_data').notNull().$type<SnapshotData>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('review_snapshots_review_idx').on(table.reviewId),
  index('review_snapshots_branch_idx').on(table.branchId),
]);

export type ReviewSnapshot = typeof reviewSnapshots.$inferSelect;
export type NewReviewSnapshot = typeof reviewSnapshots.$inferInsert;
