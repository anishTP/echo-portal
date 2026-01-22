import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { branchStateEnum, actorTypeEnum } from './enums.js';
import { branches } from './branches.js';

export const branchStateTransitions = pgTable('branch_state_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  fromState: branchStateEnum('from_state').notNull(),
  toState: branchStateEnum('to_state').notNull(),
  actorId: text('actor_id').notNull(),
  actorType: actorTypeEnum('actor_type').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BranchStateTransition = typeof branchStateTransitions.$inferSelect;
export type NewBranchStateTransition = typeof branchStateTransitions.$inferInsert;
