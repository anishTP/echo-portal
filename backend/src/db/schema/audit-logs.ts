import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { actorTypeEnum, auditOutcomeEnum } from './enums.js';

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
  // FR-021: Permission decision logging
  outcome: auditOutcomeEnum('outcome').notNull(),
  // FR-003: AI-assisted action attribution
  initiatingUserId: uuid('initiating_user_id'),
  metadata: jsonb('metadata').default({}).notNull(),
  requestId: text('request_id'),
  sessionId: text('session_id'),
}, (table) => [
  index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
  index('audit_logs_actor_id_idx').on(table.actorId),
  index('audit_logs_timestamp_idx').on(table.timestamp),
  index('audit_logs_action_idx').on(table.action),
]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
