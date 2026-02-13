import { api, type PaginatedResult } from './api';
import type { Notification, NotificationPreference } from '@echo-portal/shared';

export const notificationApi = {
  /** List user notifications */
  list(params?: {
    isRead?: boolean;
    type?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Notification>> {
    const searchParams = new URLSearchParams();
    if (params?.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
    if (params?.type) searchParams.set('type', params.type);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.getPaginated<Notification>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  /** Get unread count */
  getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>('/notifications/unread-count');
  },

  /** Mark notification as read */
  markRead(notificationId: string): Promise<Notification> {
    return api.patch<Notification>(`/notifications/${notificationId}/read`);
  },

  /** Mark all notifications as read */
  markAllRead(): Promise<{ count: number }> {
    return api.post<{ count: number }>('/notifications/mark-all-read');
  },

  /** Get notification preferences */
  getPreferences(): Promise<NotificationPreference[]> {
    return api.get<NotificationPreference[]>('/notifications/preferences');
  },

  /** Update a notification preference */
  updatePreference(category: string, enabled: boolean): Promise<NotificationPreference> {
    return api.patch<NotificationPreference>('/notifications/preferences', { category, enabled });
  },

  /** Get admin notification metrics */
  getAdminMetrics(): Promise<{
    periods: Record<string, { total: number; byType: Record<string, number> }>;
  }> {
    return api.get('/notifications/admin/metrics');
  },
};

export default notificationApi;
