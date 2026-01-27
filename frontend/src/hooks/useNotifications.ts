import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../services/notification-api';
import { useNotificationStore } from '../stores/notificationStore';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: Record<string, unknown>) => [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/**
 * Fetch unread notification count, polls every 30 seconds
 */
export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const result = await notificationApi.getUnreadCount();
      setUnreadCount(result.count);
      return result;
    },
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

/**
 * Fetch notification list
 */
export function useNotificationList(params?: {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}) {
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  return useQuery({
    queryKey: notificationKeys.list(params as Record<string, unknown>),
    queryFn: async () => {
      const result = await notificationApi.list(params);
      setNotifications(result.items);
      return result;
    },
  });
}

/**
 * Mark a notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId),
    onSuccess: (_, notificationId) => {
      markAsRead(notificationId);
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}
