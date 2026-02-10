import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { aiConfigService } from '../../services/ai/ai-config-service.js';
import { AuditLogger } from '../../services/audit/logger.js';
import { complianceConfigUpdateSchema } from '../schemas/ai-schemas.js';
import { COMPLIANCE_CATEGORIES, type ComplianceCategory, type ComplianceCategoryConfig } from '@echo-portal/shared';
import { db, schema } from '../../db/index.js';
import { paginated } from '../utils/responses.js';
import { users } from '../../db/schema/users.js';

const auditLogger = new AuditLogger();

export const aiConfigRoutes = new Hono<AuthEnv>();

/**
 * Require administrator role
 */
function requireAdmin(user: { roles?: string[] }): void {
  if (!user.roles?.includes('administrator')) {
    throw Object.assign(new Error('Administrator access required'), { status: 403 });
  }
}

/**
 * GET /api/v1/ai/config — Get AI configuration (admin only)
 */
aiConfigRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  try {
    requireAdmin(user);
    const config = await aiConfigService.getFullConfig();
    return c.json({ config });
  } catch (error: any) {
    if (error.status === 403) {
      return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch config' } }, 500);
  }
});

/**
 * PUT /api/v1/ai/config — Update AI configuration (admin only)
 */
aiConfigRoutes.put('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  try {
    requireAdmin(user);

    const body = await c.req.json();
    const updates: Array<{ scope: string; key: string; value: unknown }> = [];

    // Parse global config
    if (body.global) {
      for (const [key, value] of Object.entries(body.global)) {
        updates.push({ scope: 'global', key, value });
      }
    }

    // Parse role config
    if (body.roles) {
      for (const [role, config] of Object.entries(body.roles)) {
        for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
          updates.push({ scope: `role:${role}`, key, value });
        }
      }
    }

    // Apply all updates
    for (const { scope, key, value } of updates) {
      await aiConfigService.update(scope, key, value, user.id);
    }

    // Audit log
    await auditLogger.log({
      action: 'ai.config_changed',
      actorId: user.id,
      actorType: 'user',
      resourceType: 'content',
      resourceId: 'ai-config',
      metadata: { updates },
    });

    // Process compliance category updates (008-image-compliance-analysis)
    if (body.compliance) {
      const parsed = complianceConfigUpdateSchema.safeParse(body.compliance);
      if (!parsed.success) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid compliance configuration', details: parsed.error.issues } },
          400,
        );
      }

      const complianceUpdates: Array<{ category: string; oldValue: ComplianceCategoryConfig | null; newValue: ComplianceCategoryConfig }> = [];
      const currentConfig = await aiConfigService.getComplianceCategories();

      for (const [category, config] of Object.entries(parsed.data)) {
        const oldValue = currentConfig[category as ComplianceCategory] ?? null;
        await aiConfigService.updateComplianceCategory(
          category as ComplianceCategory,
          config,
          user.id,
        );
        complianceUpdates.push({ category, oldValue, newValue: config });
      }

      if (complianceUpdates.length > 0) {
        await auditLogger.log({
          action: 'compliance.config_changed',
          actorId: user.id,
          actorType: 'user',
          resourceType: 'content',
          resourceId: 'compliance-config',
          metadata: { updates: complianceUpdates },
        });
      }
    }

    const config = await aiConfigService.getFullConfig();
    return c.json({ success: true, config });
  } catch (error: any) {
    if (error.status === 403) {
      return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update config' } }, 500);
  }
});

// Schema for AI audit query parameters
const aiAuditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  providerId: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/v1/ai/audit — Query AI-related audit logs (admin only)
 * T047: Returns paginated audit logs filtered by AI actions
 */
aiConfigRoutes.get('/audit', requireAuth, zValidator('query', aiAuditQuerySchema), async (c) => {
  const user = c.get('user')!;
  try {
    requireAdmin(user);

    const query = c.req.valid('query');
    const { userId, providerId, action, dateFrom, dateTo, page, limit } = query;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [];

    // Filter by AI-related actions (actions starting with 'ai.')
    if (action) {
      conditions.push(eq(schema.auditLogs.action, action));
    } else {
      // Match all actions starting with 'ai.'
      conditions.push(like(schema.auditLogs.action, 'ai.%'));
    }

    // Filter by user (actorId or initiatingUserId)
    if (userId) {
      conditions.push(eq(schema.auditLogs.actorId, userId));
    }

    // Filter by provider ID (in metadata)
    if (providerId) {
      conditions.push(
        sql`${schema.auditLogs.metadata}->>'providerId' = ${providerId}`
      );
    }

    // Filter by date range
    if (dateFrom) {
      conditions.push(gte(schema.auditLogs.timestamp, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(schema.auditLogs.timestamp, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query audit logs with pagination
    const [auditEntries, countResult] = await Promise.all([
      db.query.auditLogs.findMany({
        where: whereClause,
        orderBy: [desc(schema.auditLogs.timestamp)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.auditLogs)
        .where(whereClause),
    ]);

    // Enrich with user information
    const enrichedEntries = await Promise.all(
      auditEntries.map(async (entry) => {
        let actor = undefined;
        if (entry.actorType === 'user') {
          const userRecord = await db.query.users.findFirst({
            where: eq(users.id, entry.actorId),
          });
          if (userRecord) {
            actor = {
              id: userRecord.id,
              email: userRecord.email,
              displayName: userRecord.displayName,
              avatarUrl: userRecord.avatarUrl ?? undefined,
            };
          }
        }

        return {
          id: entry.id,
          timestamp: entry.timestamp,
          action: entry.action,
          actorId: entry.actorId,
          actorType: entry.actorType,
          actorIp: entry.actorIp,
          actorUserAgent: entry.actorUserAgent,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          outcome: entry.outcome,
          initiatingUserId: entry.initiatingUserId,
          metadata: entry.metadata,
          requestId: entry.requestId,
          sessionId: entry.sessionId,
          actor,
        };
      })
    );

    const total = Number(countResult[0]?.count ?? 0);
    const hasMore = offset + limit < total;

    return paginated(c, enrichedEntries, {
      page,
      limit,
      total,
      hasMore,
    });
  } catch (error: any) {
    if (error.status === 403) {
      return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } }, 500);
  }
});
