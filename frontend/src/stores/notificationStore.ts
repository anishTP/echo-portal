import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@echo-portal/shared';

interface NotificationState {
  // Unread count for badge
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // Notification list
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;

  // Mark a notification as read locally
  markAsRead: (notificationId: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),

      notifications: [],
      setNotifications: (notifications) => set({ notifications }),

      markAsRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),
    }),
    { name: 'notification-store' }
  )
);

export default useNotificationStore;
