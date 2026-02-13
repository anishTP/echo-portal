import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@echo-portal/shared';

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;

  markAsRead: (notificationId: string) => void;

  addNotification: (notification: Notification) => void;
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

      addNotification: (notification) =>
        set((state) => {
          // Avoid duplicates
          if (state.notifications.some((n) => n.id === notification.id)) {
            return state;
          }
          return {
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          };
        }),
    }),
    { name: 'notification-store' }
  )
);

export default useNotificationStore;
