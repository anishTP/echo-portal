import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AppHeader } from '../components/layout';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('../pages/Dashboard'));
const BranchWorkspace = lazy(() => import('../pages/BranchWorkspace'));
const ReviewQueue = lazy(() => import('../pages/ReviewQueue'));
const PublishConfirm = lazy(() => import('../pages/PublishConfirm'));
const AuthCallback = lazy(() => import('../pages/AuthCallback'));
const AuditLog = lazy(() => import('../pages/AuditLog'));
const UserManagement = lazy(() => import('../pages/UserManagement'));

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
        element: <Dashboard />,
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
      // Review routes (Phase 4 - US2)
      {
        path: 'reviews',
        element: <ReviewQueue />,
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
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
