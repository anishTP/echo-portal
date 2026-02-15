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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-6">
          {/* Left zone: Logo + Branch/Version */}
          <div className="flex items-center gap-3 shrink-0">
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
          <div className="flex-1 flex justify-center">
            <HeaderNav />
          </div>

          {/* Right zone: Search, Notifications, Theme, User */}
          <div className="flex items-center gap-3 shrink-0">
            <HeaderSearchBar />
            {isLoading ? (
              <Spinner size="2" />
            ) : isAuthenticated ? (
              <>
                <NotificationPopover />
                <ThemeToggle />
                <UserAvatarMenu />
              </>
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
      </div>
    </header>
  );
}

export default AppHeader;
