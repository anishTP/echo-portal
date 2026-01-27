import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// UI Store - for global UI state
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id: crypto.randomUUID() },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    { name: 'ui-store' }
  )
);

// App Store - for application-wide state
interface AppState {
  // Current environment indicator
  environment: 'main' | 'dev' | 'stage';
  setEnvironment: (env: 'main' | 'dev' | 'stage') => void;

  // Feature flags
  features: Record<string, boolean>;
  setFeature: (key: string, enabled: boolean) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      environment: 'main',
      setEnvironment: (environment) => set({ environment }),

      features: {},
      setFeature: (key, enabled) =>
        set((state) => ({
          features: { ...state.features, [key]: enabled },
        })),
    }),
    { name: 'app-store' }
  )
);

// Export store hooks
export { useUIStore as useUI, useAppStore as useApp };
