import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { branchStateEnum, visibilityEnum } from './enums.js';
import { users } from './users.js';

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  gitRef: text('git_ref').unique().notNull(),
  baseRef: text('base_ref').notNull(),
  baseCommit: text('base_commit').notNull(),
  headCommit: text('head_commit').notNull(),
  state: branchStateEnum('state').default('draft').notNull(),
  visibility: visibilityEnum('visibility').default('private').notNull(),
  ownerId: uuid('owner_id')
    .references(() => users.id)
    .notNull(),
  reviewers: uuid('reviewers').array().default([]),
  description: text('description'),
  labels: text('labels').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
