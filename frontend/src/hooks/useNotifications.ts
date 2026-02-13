import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../services/notification-api';
import { useNotificationStore } from '../stores/notificationStore';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: Record<string, unknown>) => [...notificationKeys.all, 'list', params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
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
    refetchInterval: 30_000,
  });
}

/**
 * Fetch notification list
 */
export function useNotificationList(params?: {
  isRead?: boolean;
  type?: string;
  category?: string;
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
      // Update list query cache so the UI reflects read state immediately
      queryClient.setQueriesData(
        { queryKey: [...notificationKeys.all, 'list'] },
        (old: any) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((n: any) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            ),
          };
        }
      );
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Fetch notification preferences
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationApi.getPreferences(),
  });
}

/**
 * Update a notification preference
 */
export function useUpdatePreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, enabled }: { category: string; enabled: boolean }) =>
      notificationApi.updatePreference(category, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}
