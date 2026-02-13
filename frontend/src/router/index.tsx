import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AppHeader } from '../components/layout';

// Lazy load pages for code splitting
const Library = lazy(() => import('../pages/Library'));
const ContentView = lazy(() => import('../pages/ContentView'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const BranchWorkspace = lazy(() => import('../pages/BranchWorkspace'));
const PublishConfirm = lazy(() => import('../pages/PublishConfirm'));
const AuthCallback = lazy(() => import('../pages/AuthCallback'));
const AuditLog = lazy(() => import('../pages/AuditLog'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const AIAdmin = lazy(() => import('../pages/AIAdmin'));
const Notifications = lazy(() => import('../pages/Notifications'));
const NotificationSettings = lazy(() => import('../pages/NotificationSettings'));

// Loading fallback
function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-2 text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

// Root layout component
function RootLayout() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <Suspense fallback={<LoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

// Router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Library />,
      },
      {
        path: 'library',
        element: <Library />,
      },
      {
        path: 'library/:slug',
        element: <Library />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      // Auth callback route (Phase 3 - US1)
      {
        path: 'auth/callback',
        element: <AuthCallback />,
      },
      // Branch routes (Phase 3 - US1)
      {
        path: 'branches/:id',
        element: <BranchWorkspace />,
      },
      // Content edit route (Phase 5 - Inline Edit)
      {
        path: 'branches/:id/content/:contentId/edit',
        element: <BranchWorkspace />,
      },
      // Publish routes (Phase 5 - US3)
      {
        path: 'branches/:id/publish',
        element: <PublishConfirm />,
      },
      // Audit log routes (Phase 8 - US6)
      {
        path: 'audit',
        element: <AuditLog />,
      },
      // User management routes (Phase 9 - US7)
      {
        path: 'users',
        element: <UserManagement />,
      },
      // AI administration routes (007-ai-assisted-authoring)
      {
        path: 'admin/ai',
        element: <AIAdmin />,
      },
      // Notification routes (009-notification-alerts)
      {
        path: 'notifications',
        element: <Notifications />,
      },
      {
        path: 'settings/notifications',
        element: <NotificationSettings />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
