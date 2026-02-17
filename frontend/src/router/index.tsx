import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { AppHeader } from '../components/layout';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('../pages/LandingPage'));
const Library = lazy(() => import('../pages/Library'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const BranchWorkspace = lazy(() => import('../pages/BranchWorkspace'));
const PublishConfirm = lazy(() => import('../pages/PublishConfirm'));
const AuthCallback = lazy(() => import('../pages/AuthCallback'));
const AuditLog = lazy(() => import('../pages/AuditLog'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const VerifyEmailPage = lazy(() => import('../pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));

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
        element: <LandingPage />,
      },
      {
        path: 'library',
        element: <Library />,
      },
      {
        path: 'library/:slug',
        element: <Library />,
      },
      // Unified profile page
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      // Redirects from old routes to unified profile
      {
        path: 'dashboard',
        element: <Navigate to="/profile?tab=dashboard" replace />,
      },
      {
        path: 'notifications',
        element: <Navigate to="/profile?tab=notifications" replace />,
      },
      {
        path: 'settings/notifications',
        element: <Navigate to="/profile?tab=settings" replace />,
      },
      {
        path: 'settings/account',
        element: <Navigate to="/profile?tab=settings" replace />,
      },
      // Email/password auth routes (010-email-password-auth)
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'signup',
        element: <SignupPage />,
      },
      {
        path: 'verify-email',
        element: <VerifyEmailPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
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
      // Redirect old admin route to unified profile
      {
        path: 'admin',
        element: <Navigate to="/profile?tab=admin" replace />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
