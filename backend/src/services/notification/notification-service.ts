import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import type { Notification as NotificationResponse } from '@echo-portal/shared';

export const notificationService = {
  /**
   * Create a notification for a user.
   */
  async create(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
  }): Promise<NotificationResponse> {
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      })
      .returning();

    return formatNotification(notification);
  },

  /**
   * Create notifications for multiple users.
   */
  async createBulk(
    userIds: string[],
    input: {
      type: string;
      title: string;
      message: string;
      resourceType?: string;
      resourceId?: string;
    }
  ): Promise<void> {
    if (userIds.length === 0) return;

    await db.insert(schema.notifications).values(
      userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      }))
    );
  },

  /**
   * List notifications for a user with optional filters.
   */
  async list(
    userId: string,
    options: { isRead?: boolean; type?: string; page?: number; limit?: number }
  ): Promise<{ items: NotificationResponse[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.notifications.userId, userId)];
    if (options.isRead !== undefined) {
      conditions.push(eq(schema.notifications.isRead, options.isRead));
    }
    if (options.type) {
      conditions.push(eq(schema.notifications.type, options.type));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.notifications.findMany({
        where: whereClause,
        orderBy: [desc(schema.notifications.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(schema.notifications).where(whereClause!),
    ]);

    return {
      items: items.map(formatNotification),
      total: Number(countResult[0]?.count ?? 0),
    };
  },

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false)));

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Mark a notification as read.
   */
  async markRead(notificationId: string, userId: string): Promise<NotificationResponse | null> {
    const [updated] = await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, userId))
      )
      .returning();

    return updated ? formatNotification(updated) : null;
  },
};

function formatNotification(
  notification: typeof schema.notifications.$inferSelect
): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type as NotificationResponse['type'],
    title: notification.title,
    message: notification.message,
    resourceType: notification.resourceType ?? undefined,
    resourceId: notification.resourceId ?? undefined,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString(),
  };
}
