import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { notificationService } from '../../services/notification/notification-service.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, paginated } from '../utils/responses.js';
import { uuidSchema, paginationSchema } from '../schemas/common.js';

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
      type: z
        .enum(['review_requested', 'review_completed', 'changes_requested', 'content_published'])
        .optional(),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    const result = await notificationService.list(user.id, {
      isRead: query.isRead,
      type: query.type,
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
