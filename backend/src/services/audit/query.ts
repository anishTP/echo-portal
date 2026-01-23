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

    return entries.map((entry) => ({
      ...entry,
      actor: actorMap.get(entry.actorId) || undefined,
    }));
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
}

// Export singleton instance
export const auditQueryService = new AuditQueryService();
