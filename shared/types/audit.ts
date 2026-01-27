/**
 * Audit log types for Phase 8 (US6)
 */
import type { ActorTypeValue } from '../constants/states.js';

export type AuditOutcomeValue = 'success' | 'failure' | 'denied';
export type AuditResourceType = 'branch' | 'review' | 'convergence' | 'user' | 'permission' | 'auth' | 'session';

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  actorId: string;
  actorType: ActorTypeValue;
  actorIp: string | null;
  actorUserAgent: string | null;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcomeValue | null;
  initiatingUserId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  sessionId: string | null;
}

export interface AuditActor {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface AuditEntryWithActor extends AuditLog {
  actor?: AuditActor;
}

export interface AuditQueryOptions {
  resourceType?: AuditResourceType;
  resourceId?: string;
  actorId?: string;
  actions?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  entries: AuditEntryWithActor[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResourceType: Record<string, number>;
  recentActivity: Array<{ date: string; count: number }>;
}

export interface FailedLoginSummary {
  totalFailedAttempts: number;
  uniqueUsers: number;
  lockedAccounts: number;
}

export interface FailedLoginReport {
  entries: AuditEntryWithActor[];
  summary: FailedLoginSummary;
}

export interface PermissionDenialSummary {
  totalDenials: number;
  uniqueActors: number;
  mostDeniedAction: string | null;
}

export interface PermissionDenialAggregation {
  actorId: string;
  action: string;
  resourceType: string;
  count: number;
  lastAttempt: Date;
}

export interface PermissionDenialReport {
  entries: AuditEntryWithActor[];
  aggregated: PermissionDenialAggregation[];
  summary: PermissionDenialSummary;
}
