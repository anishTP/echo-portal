import { Link, useLocation } from 'react-router-dom';
import { Button, Spinner } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { LoginButton, LogoutButton, RoleBadge } from '../auth';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
  const { user, isAuthenticated, isLoading, loginDev } = useAuth();
  const isDev = import.meta.env.DEV;
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/library');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--gray-6)] bg-[var(--color-background)] shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-lg" style={{ background: 'var(--accent-9)' }}>
                E
              </div>
              <span className="text-xl font-bold" style={{ color: 'var(--gray-12)' }}>Echo Portal</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/"
                className="text-sm font-medium transition-colors"
                style={{ color: isActive('/') ? 'var(--accent-11)' : 'var(--gray-11)' }}
              >
                Library
              </Link>
              {isAuthenticated && (
                <Link
                  to="/dashboard"
                  className="text-sm font-medium transition-colors"
                  style={{ color: isActive('/dashboard') ? 'var(--accent-11)' : 'var(--gray-11)' }}
                >
                  Dashboard
                </Link>
              )}
            </nav>
          </div>

          {/* Auth State */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner size="1" />
                <span>Loading...</span>
              </div>
            ) : isAuthenticated && user ? (
              <>
                {/* User Info */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="h-8 w-8 rounded-full border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* User Details */}
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {user.displayName}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>

                  {/* Role Badge */}
                  <RoleBadge role={user.role} size="sm" />
                </div>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Logout Button */}
                <LogoutButton size="sm" variant="secondary" showIcon={false} />
              </>
            ) : (
              /* Login Buttons */
              <div className="flex items-center gap-2">
                {/* Theme Toggle */}
                <ThemeToggle />
                {isDev && (
                  <Button
                    onClick={loginDev}
                    variant="soft"
                    color="orange"
                    size="2"
                  >
                    Dev Login
                  </Button>
                )}
                <LoginButton provider="github" size="2" />
                <LoginButton provider="google" size="2" />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
