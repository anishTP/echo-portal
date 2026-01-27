import { pgTable, uuid, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    provider: text('provider').notNull(), // 'github' | 'google'
    success: boolean('success').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    failureReason: text('failure_reason'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('login_attempts_email_idx').on(table.email),
    index('login_attempts_attempted_at_idx').on(table.attemptedAt),
    index('login_attempts_email_success_idx').on(table.email, table.success),
  ],
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
