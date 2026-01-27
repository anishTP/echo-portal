import { db } from '../../db/index.js';
import { auditLogs, type AuditLog } from '../../db/schema/audit-logs.js';
import { users } from '../../db/schema/users.js';
import { eq, and, or, desc, gte, lte, sql, inArray } from 'drizzle-orm';

export interface AuditQueryOptions {
  resourceType?: 'branch' | 'review' | 'convergence' | 'user';
  resourceId?: string;
  actorId?: string;
  actions?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditEntryWithActor extends AuditLog {
  actor?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
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
  recentActivity: { date: string; count: number }[];
}

/**
 * Service for querying audit logs
 */
export class AuditQueryService {
  /**
   * Query audit logs with filters
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditQueryResult> {
    const {
      resourceType,
      resourceId,
      actorId,
      actions,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;

    const conditions = [];

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (actorId) {
      conditions.push(eq(auditLogs.actorId, actorId));
    }

    if (actions && actions.length > 0) {
      conditions.push(inArray(auditLogs.action, actions));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get entries with pagination
    const offset = (page - 1) * limit;
    const entries = await db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset,
    });

    // Enrich with actor details
    const enrichedEntries = await this.enrichWithActors(entries);

    return {
      entries: enrichedEntries,
      total,
      page,
      limit,
      hasMore: offset + entries.length < total,
    };
  }

  /**
   * Get audit history for a specific resource
   */
  async getResourceHistory(
    resourceType: string,
    resourceId: string,
    options: { limit?: number; before?: Date } = {}
  ): Promise<AuditEntryWithActor[]> {
    const { limit = 100, before } = options;

    const conditions = [
      eq(auditLogs.resourceType, resourceType),
      eq(auditLogs.resourceId, resourceId),
    ];

    if (before) {
      conditions.push(lte(auditLogs.timestamp, before));
    }

    const entries = await db.query.auditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
    });

    return this.enrichWithActors(entries);
  }

  /**
   * Get audit logs for a branch including related reviews and convergence
   */
  async getBranchFullHistory(
    branchId: string,
    options: { limit?: number } = {}
  ): Promise<AuditEntryWithActor[]> {
    const { limit = 200 } = options;

    // Get branch events, plus related review and convergence events
    const entries = await db.query.auditLogs.findMany({
      where: or(
        and(
          eq(auditLogs.resourceType, 'branch'),
          eq(auditLogs.resourceId, branchId)
        ),
        sql`${auditLogs.metadata}->>'branchId' = ${branchId}`
      ),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
    });

    return this.enrichWithActors(entries);
  }

  /**
   * Get audit statistics for a date range
   */
  async getStats(options: {
    startDate?: Date;
    endDate?: Date;
    resourceType?: string;
  } = {}): Promise<AuditStats> {
    const { startDate, endDate, resourceType } = options;

    const conditions = [];
    if (startDate) conditions.push(gte(auditLogs.timestamp, startDate));
    if (endDate) conditions.push(lte(auditLogs.timestamp, endDate));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total events
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);

    // Events by action
    const actionStats = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.action);

    // Events by resource type
    const resourceStats = await db
      .select({
        resourceType: auditLogs.resourceType,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.resourceType);

    // Recent activity (last 7 days)
    const recentActivity = await db
      .select({
        date: sql<string>`date_trunc('day', ${auditLogs.timestamp})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.timestamp, sql`now() - interval '7 days'`),
          whereClause
        )
      )
      .groupBy(sql`date_trunc('day', ${auditLogs.timestamp})`)
      .orderBy(sql`date_trunc('day', ${auditLogs.timestamp})`);

    return {
      totalEvents: totalResult[0]?.count || 0,
      eventsByAction: Object.fromEntries(
        actionStats.map((s) => [s.action, s.count])
      ),
      eventsByResourceType: Object.fromEntries(
        resourceStats.map((s) => [s.resourceType, s.count])
      ),
      recentActivity: recentActivity.map((r) => ({
        date: r.date,
        count: r.count,
      })),
    };
  }

  /**
   * Enrich audit entries with actor details
   */
  private async enrichWithActors(
    entries: AuditLog[]
  ): Promise<AuditEntryWithActor[]> {
    if (entries.length === 0) return [];

    // Get unique actor IDs
    const actorIds = [...new Set(entries.map((e) => e.actorId))];

    // Fetch actor details
    const actors = await db.query.users.findMany({
      where: inArray(users.id, actorIds),
      columns: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return entries.map((entry) => {
      const actor = actorMap.get(entry.actorId);
      return {
        ...entry,
        actor: actor ? { ...actor, avatarUrl: actor.avatarUrl || undefined } : undefined,
      };
    });
  }

  /**
   * Get recent activity for a user
   */
  async getUserActivity(
    userId: string,
    options: { limit?: number } = {}
  ): Promise<AuditEntryWithActor[]> {
    const { limit = 50 } = options;

    const entries = await db.query.auditLogs.findMany({
      where: eq(auditLogs.actorId, userId),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
    });

    return this.enrichWithActors(entries);
  }

  /**
   * Get failed login report for security monitoring (T085)
   */
  async getFailedLoginReport(options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<{
    entries: AuditEntryWithActor[];
    summary: {
      totalFailedAttempts: number;
      uniqueUsers: number;
      lockedAccounts: number;
    };
  }> {
    const { startDate, endDate, limit = 100 } = options;

    const conditions = [
      inArray(auditLogs.action, ['auth.failed', 'auth.locked']),
    ];

    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }

    // Get failed login entries
    const entries = await db.query.auditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
    });

    // Calculate summary statistics
    const failedAttempts = entries.filter((e) => e.action === 'auth.failed');
    const lockedAccounts = entries.filter((e) => e.action === 'auth.locked');
    const uniqueUsers = new Set(entries.map((e) => e.actorId)).size;

    const enrichedEntries = await this.enrichWithActors(entries);

    return {
      entries: enrichedEntries,
      summary: {
        totalFailedAttempts: failedAttempts.length,
        uniqueUsers,
        lockedAccounts: lockedAccounts.length,
      },
    };
  }

  /**
   * Get permission denial report (T086)
   * Aggregated denials by actor/action for security monitoring
   */
  async getPermissionDenialReport(options: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    resourceType?: string;
    limit?: number;
  } = {}): Promise<{
    entries: AuditEntryWithActor[];
    aggregated: Array<{
      actorId: string;
      action: string;
      resourceType: string;
      count: number;
      lastAttempt: Date;
    }>;
    summary: {
      totalDenials: number;
      uniqueActors: number;
      mostDeniedAction: string | null;
    };
  }> {
    const { startDate, endDate, actorId, resourceType, limit = 100 } = options;

    const conditions = [
      eq(auditLogs.outcome, 'denied'),
    ];

    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }

    if (actorId) {
      conditions.push(eq(auditLogs.actorId, actorId));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    // Get denied permission entries
    const entries = await db.query.auditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
    });

    // Aggregate by actor, action, and resource type
    const aggregationMap = new Map<string, {
      actorId: string;
      action: string;
      resourceType: string;
      count: number;
      lastAttempt: Date;
    }>();

    for (const entry of entries) {
      const key = `${entry.actorId}:${entry.action}:${entry.resourceType}`;
      const existing = aggregationMap.get(key);

      if (existing) {
        existing.count++;
        if (entry.timestamp > existing.lastAttempt) {
          existing.lastAttempt = entry.timestamp;
        }
      } else {
        aggregationMap.set(key, {
          actorId: entry.actorId,
          action: entry.action,
          resourceType: entry.resourceType,
          count: 1,
          lastAttempt: entry.timestamp,
        });
      }
    }

    const aggregated = Array.from(aggregationMap.values())
      .sort((a, b) => b.count - a.count);

    // Calculate summary
    const uniqueActors = new Set(entries.map((e) => e.actorId)).size;
    const actionCounts = new Map<string, number>();

    for (const entry of entries) {
      actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
    }

    const mostDeniedAction = actionCounts.size > 0
      ? Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const enrichedEntries = await this.enrichWithActors(entries);

    return {
      entries: enrichedEntries,
      aggregated,
      summary: {
        totalDenials: entries.length,
        uniqueActors,
        mostDeniedAction,
      },
    };
  }
}

// Export singleton instance
export const auditQueryService = new AuditQueryService();
