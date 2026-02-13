import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { auditLogger } from '../audit/logger.js';
import { notificationSSE } from './notification-sse.js';
import { NOTIFICATION_TYPE_TO_CATEGORY } from '@echo-portal/shared';
import type { Notification as NotificationResponse, NotificationCategoryValue } from '@echo-portal/shared';

const VALID_CATEGORIES: NotificationCategoryValue[] = ['review', 'lifecycle', 'ai'];

export const notificationService = {
  /**
   * Filter recipient list by removing self, deactivated users, users without branch access, and users with disabled preferences.
   */
  async resolveRecipients(
    userIds: string[],
    actorId: string | undefined,
    category: NotificationCategoryValue,
    branchId?: string
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    // 1. Self-suppression: remove the actor
    let filtered = actorId ? userIds.filter((id) => id !== actorId) : [...userIds];
    if (filtered.length === 0) return [];

    // 2. Deactivated user filtering: only keep active users
    const activeUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(inArray(schema.users.id, filtered), eq(schema.users.isActive, true)));

    const activeIds = new Set(activeUsers.map((u) => u.id));
    filtered = filtered.filter((id) => activeIds.has(id));
    if (filtered.length === 0) return [];

    // 3. Branch visibility enforcement (if branchId provided)
    if (branchId) {
      const [branch] = await db
        .select({
          visibility: schema.branches.visibility,
          ownerId: schema.branches.ownerId,
          collaborators: schema.branches.collaborators,
          reviewers: schema.branches.reviewers,
        })
        .from(schema.branches)
        .where(eq(schema.branches.id, branchId))
        .limit(1);

      if (branch && branch.visibility === 'private') {
        const allowedUsers = new Set<string>();
        allowedUsers.add(branch.ownerId);
        branch.collaborators?.forEach((id: string) => allowedUsers.add(id));
        branch.reviewers?.forEach((id: string) => allowedUsers.add(id));

        // Also allow admins
        const adminUsers = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              inArray(schema.users.id, filtered),
              sql`'administrator' = ANY(${schema.users.roles})`
            )
          );
        adminUsers.forEach((u) => allowedUsers.add(u.id));

        filtered = filtered.filter((id) => allowedUsers.has(id));
        if (filtered.length === 0) return [];
      }
    }

    // 4. Preference checking: exclude users who disabled this category
    const disabledPrefs = await db
      .select({ userId: schema.notificationPreferences.userId })
      .from(schema.notificationPreferences)
      .where(
        and(
          inArray(schema.notificationPreferences.userId, filtered),
          eq(schema.notificationPreferences.category, category),
          eq(schema.notificationPreferences.enabled, false)
        )
      );

    const disabledUsers = new Set(disabledPrefs.map((p) => p.userId));
    filtered = filtered.filter((id) => !disabledUsers.has(id));

    return filtered;
  },

  /**
   * Get notification preferences for a user. Missing rows default to enabled.
   */
  async getPreferences(userId: string): Promise<{ category: NotificationCategoryValue; enabled: boolean }[]> {
    const prefs = await db
      .select({ category: schema.notificationPreferences.category, enabled: schema.notificationPreferences.enabled })
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId));

    const prefMap = new Map(prefs.map((p) => [p.category, p.enabled]));
    return VALID_CATEGORIES.map((cat) => ({
      category: cat,
      enabled: prefMap.get(cat) ?? true,
    }));
  },

  /**
   * Update a notification preference for a user. Creates row on first use.
   */
  async updatePreference(
    userId: string,
    category: NotificationCategoryValue,
    enabled: boolean
  ): Promise<{ category: NotificationCategoryValue; enabled: boolean }> {
    // Get old value for audit
    const [existing] = await db
      .select({ enabled: schema.notificationPreferences.enabled })
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.userId, userId),
          eq(schema.notificationPreferences.category, category)
        )
      )
      .limit(1);

    const oldValue = existing?.enabled ?? true;

    // Upsert
    await db
      .insert(schema.notificationPreferences)
      .values({ userId, category, enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.notificationPreferences.userId, schema.notificationPreferences.category],
        set: { enabled, updatedAt: new Date() },
      });

    // Audit log
    await auditLogger.log({
      action: 'notification_preference_changed',
      actorId: userId,
      actorType: 'user',
      resourceType: 'user',
      resourceId: userId,
      metadata: { category, oldValue, newValue: enabled },
    });

    return { category, enabled };
  },

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false)));

    const count = result.rowCount ?? 0;

    if (count > 0) {
      await auditLogger.log({
        action: 'notifications_bulk_read',
        actorId: userId,
        actorType: 'user',
        resourceType: 'user',
        resourceId: userId,
        metadata: { count },
      });
    }

    return count;
  },

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
    category?: string;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const category = input.category || NOTIFICATION_TYPE_TO_CATEGORY[input.type as keyof typeof NOTIFICATION_TYPE_TO_CATEGORY] || 'review';

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId: input.userId,
        type: input.type,
        category,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actorId: input.actorId,
      })
      .returning();

    return formatNotification(notification);
  },

  /**
   * Create notifications for multiple users with recipient filtering.
   */
  async createBulk(
    userIds: string[],
    input: {
      type: string;
      title: string;
      message: string;
      resourceType?: string;
      resourceId?: string;
      category?: string;
      actorId?: string;
    },
    options?: { branchId?: string; skipFiltering?: boolean }
  ): Promise<void> {
    if (userIds.length === 0) return;

    const category = input.category || NOTIFICATION_TYPE_TO_CATEGORY[input.type as keyof typeof NOTIFICATION_TYPE_TO_CATEGORY] || 'review';

    let recipients = userIds;
    if (!options?.skipFiltering) {
      recipients = await this.resolveRecipients(
        userIds,
        input.actorId,
        category as NotificationCategoryValue,
        options?.branchId
      );
    }

    if (recipients.length === 0) return;

    const inserted = await db.insert(schema.notifications).values(
      recipients.map((userId) => ({
        userId,
        type: input.type,
        category,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actorId: input.actorId,
      }))
    ).returning();

    // Fire-and-forget SSE delivery
    for (const notification of inserted) {
      const formatted = formatNotification(notification);
      notificationSSE.publish(notification.userId, formatted).catch(() => {});
      notificationService.getUnreadCount(notification.userId).then((count) => {
        notificationSSE.publishCount(notification.userId, count).catch(() => {});
      }).catch(() => {});
    }
  },

  /**
   * List notifications for a user with optional filters. Joins users table for actorName.
   */
  async list(
    userId: string,
    options: { isRead?: boolean; type?: string; category?: string; page?: number; limit?: number }
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
    if (options.category) {
      conditions.push(eq(schema.notifications.category, options.category));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select({
          notification: schema.notifications,
          actorName: schema.users.displayName,
        })
        .from(schema.notifications)
        .leftJoin(schema.users, eq(schema.notifications.actorId, schema.users.id))
        .where(whereClause!)
        .orderBy(desc(schema.notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(schema.notifications).where(whereClause!),
    ]);

    return {
      items: items.map((row) => formatNotificationWithActor(row.notification, row.actorName)),
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

    if (!updated) return null;

    // Fetch actor name
    let actorName: string | null = null;
    if (updated.actorId) {
      const [actor] = await db
        .select({ displayName: schema.users.displayName })
        .from(schema.users)
        .where(eq(schema.users.id, updated.actorId))
        .limit(1);
      actorName = actor?.displayName ?? null;
    }

    return formatNotificationWithActor(updated, actorName);
  },
};

function formatNotification(
  notification: typeof schema.notifications.$inferSelect
): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type as NotificationResponse['type'],
    category: notification.category as NotificationResponse['category'],
    title: notification.title,
    message: notification.message,
    resourceType: notification.resourceType ?? undefined,
    resourceId: notification.resourceId ?? undefined,
    actorId: notification.actorId ?? undefined,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString(),
  };
}

function formatNotificationWithActor(
  notification: typeof schema.notifications.$inferSelect,
  actorName: string | null
): NotificationResponse {
  return {
    ...formatNotification(notification),
    actorName: actorName ?? undefined,
  };
}
