import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    actorId: uuid('actor_id').references(() => users.id),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_read_idx').on(table.userId, table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
    index('notifications_user_category_idx').on(table.userId, table.category),
  ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
