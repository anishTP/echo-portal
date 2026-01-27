import { api, type PaginatedResult } from './api';
import type { Notification } from '@echo-portal/shared';

export const notificationApi = {
  /** List user notifications */
  list(params?: {
    isRead?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Notification>> {
    const searchParams = new URLSearchParams();
    if (params?.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
    if (params?.type) searchParams.set('type', params.type);
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
};

export default notificationApi;
