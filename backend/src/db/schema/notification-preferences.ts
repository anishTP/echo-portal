import { pgTable, uuid, text, timestamp, boolean, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    category: text('category').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_preferences_user_category_uniq').on(table.userId, table.category),
    index('notification_preferences_user_idx').on(table.userId),
  ]
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
