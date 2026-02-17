import { Link, useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { EchoLogo } from './EchoLogo';
import { HeaderNav } from './HeaderNav';
import { HeaderSearchBar } from './HeaderSearchBar';
import { UserAvatarMenu } from './UserAvatarMenu';
import { ThemeToggle } from './ThemeToggle';
import { BranchSelector } from './BranchSelector';
import { NotificationPopover } from '../notification/NotificationPopover';

export function AppHeader() {
  const { isAuthenticated, isLoading, loginDev } = useAuth();
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--color-background)] shadow-sm"
      style={{ borderBottom: '2px solid #FF5310' }}
    >
      <div className="flex h-16 items-center px-6">
        {/* Left zone: Logo + Branch/Version */}
        <div className="flex flex-1 items-center gap-3">
          <Link to="/" className="flex items-center">
            <EchoLogo />
          </Link>
          {isAuthenticated ? (
            <BranchSelector />
          ) : (
            <span className="text-xs font-medium" style={{ color: 'var(--gray-9)' }}>
              v1.0.0
            </span>
          )}
        </div>

        {/* Center zone: Section nav */}
        <div className="flex flex-1 justify-center">
          <HeaderNav />
        </div>

        {/* Right zone: Search, Notifications, Theme, User */}
        <div className="flex flex-1 items-center justify-end gap-4">
          <HeaderSearchBar />
          {isLoading ? (
            <Spinner size="2" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-5">
              <NotificationPopover />
              <ThemeToggle />
              <UserAvatarMenu />
            </div>
          ) : (
            <>
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
              <Button
                onClick={() => navigate('/login')}
                variant="solid"
                size="2"
              >
                Sign In
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
