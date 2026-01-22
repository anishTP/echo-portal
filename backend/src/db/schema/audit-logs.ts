import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { actorTypeEnum } from './enums.js';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id').notNull(),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorIp: text('actor_ip'),
  actorUserAgent: text('actor_user_agent'),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  requestId: text('request_id'),
  sessionId: text('session_id'),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
