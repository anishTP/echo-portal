import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { notificationService } from '../../services/notification/notification-service.js';
import { notificationSSE } from '../../services/notification/notification-sse.js';
import { db, schema } from '../../db/index.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, paginated } from '../utils/responses.js';
import { uuidSchema, paginationSchema } from '../schemas/common.js';
import { NotificationType } from '@echo-portal/shared';

const allNotificationTypes = Object.values(NotificationType) as [string, ...string[]];

const notificationRoutes = new Hono<AuthEnv>();

/**
 * GET /api/v1/notifications - List user notifications
 */
notificationRoutes.get(
  '/',
  requireAuth,
  zValidator(
    'query',
    paginationSchema.extend({
      isRead: z
        .string()
        .optional()
        .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
      type: z.enum(allNotificationTypes).optional(),
      category: z.enum(['review', 'lifecycle', 'ai']).optional(),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    const result = await notificationService.list(user.id, {
      isRead: query.isRead,
      type: query.type,
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    return paginated(c, result.items, {
      page: query.page,
      limit: query.limit,
      total: result.total,
      hasMore: (query.page - 1) * query.limit + result.items.length < result.total,
    });
  }
);

/**
 * GET /api/v1/notifications/unread-count - Get unread notification count
 */
notificationRoutes.get('/unread-count', requireAuth, async (c) => {
  const user = c.get('user')!;
  const count = await notificationService.getUnreadCount(user.id);
  return success(c, { count });
});

/**
 * POST /api/v1/notifications/mark-all-read - Mark all as read
 */
notificationRoutes.post('/mark-all-read', requireAuth, async (c) => {
  const user = c.get('user')!;
  const count = await notificationService.markAllRead(user.id);
  return success(c, { count });
});

/**
 * GET /api/v1/notifications/preferences - Get notification preferences
 */
notificationRoutes.get('/preferences', requireAuth, async (c) => {
  const user = c.get('user')!;
  const preferences = await notificationService.getPreferences(user.id);
  return success(c, preferences);
});

/**
 * PATCH /api/v1/notifications/preferences - Update a notification preference
 */
notificationRoutes.patch(
  '/preferences',
  requireAuth,
  zValidator(
    'json',
    z.object({
      category: z.enum(['review', 'lifecycle', 'ai']),
      enabled: z.boolean(),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const { category, enabled } = c.req.valid('json');
    const result = await notificationService.updatePreference(user.id, category, enabled);
    return success(c, result);
  }
);

/**
 * GET /api/v1/notifications/stream - SSE endpoint for real-time notifications
 */
notificationRoutes.get('/stream', requireAuth, async (c) => {
  const user = c.get('user')!;

  return streamSSE(c, async (stream) => {
    notificationSSE.subscribe(user.id, stream);

    // Send initial unread count
    const count = await notificationService.getUnreadCount(user.id);
    await stream.writeSSE({ event: 'count', data: JSON.stringify({ count }) });

    // Handle Last-Event-ID for catch-up
    const lastEventId = c.req.header('Last-Event-ID');
    if (lastEventId) {
      const missedResult = await notificationService.list(user.id, {
        page: 1,
        limit: 50,
      });
      let foundLastEvent = false;
      for (const notification of missedResult.items.reverse()) {
        if (notification.id === lastEventId) {
          foundLastEvent = true;
          continue;
        }
        if (foundLastEvent) {
          await stream.writeSSE({
            event: 'notification',
            data: JSON.stringify(notification),
            id: notification.id,
          });
        }
      }
    }

    // Keep connection alive until client disconnects
    try {
      while (true) {
        await stream.sleep(30_000);
      }
    } finally {
      notificationSSE.unsubscribe(user.id, stream);
    }
  });
});

/**
 * GET /api/v1/notifications/admin/metrics - Admin notification metrics
 */
notificationRoutes.get('/admin/metrics', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (!user.roles?.includes('administrator')) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Administrator role required' } },
      403
    );
  }

  const now = new Date();
  const periods = {
    '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  };

  const results: Record<string, { total: number; byType: Record<string, number> }> = {};

  for (const [label, since] of Object.entries(periods)) {
    const rows = await db
      .select({
        type: schema.notifications.type,
        count: sql<number>`count(*)`,
      })
      .from(schema.notifications)
      .where(sql`${schema.notifications.createdAt} >= ${since.toISOString()}`)
      .groupBy(schema.notifications.type);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byType[row.type] = Number(row.count);
      total += Number(row.count);
    }
    results[label] = { total, byType };
  }

  return success(c, { periods: results });
});

/**
 * PATCH /api/v1/notifications/:notificationId/read - Mark notification as read
 */
notificationRoutes.patch(
  '/:notificationId/read',
  requireAuth,
  zValidator('param', z.object({ notificationId: uuidSchema })),
  async (c) => {
    const user = c.get('user')!;
    const { notificationId } = c.req.valid('param');

    const notification = await notificationService.markRead(notificationId, user.id);
    if (!notification) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Notification not found or not owned by user' } },
        404
      );
    }

    return success(c, notification);
  }
);

export { notificationRoutes };
