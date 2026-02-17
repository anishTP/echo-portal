import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, Button, Text, Flex } from '@radix-ui/themes';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../auth';

export function UserAvatarMenu() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = hasRole?.('administrator') ?? false;

  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  const avatar = user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.displayName}
      className="h-8 w-8 rounded-full border border-gray-200"
    />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium" style={{ background: 'var(--gray-4)', color: 'var(--gray-11)' }}>
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="ghost" size="2" style={{ padding: '4px', borderRadius: '9999px' }}>
          {avatar}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="end" style={{ minWidth: '220px' }}>
        {/* User info label */}
        <div style={{ padding: '8px 12px' }}>
          <Flex align="center" gap="2">
            <div>
              <Text size="2" weight="bold" style={{ display: 'block', color: 'var(--gray-12)' }}>
                {user.displayName}
              </Text>
              <Text size="1" style={{ color: 'var(--gray-10)' }}>
                {user.email}
              </Text>
            </div>
            <RoleBadge role={user.role} size="sm" />
          </Flex>
        </div>

        <DropdownMenu.Separator />

        <DropdownMenu.Item onClick={() => navigate('/profile?tab=dashboard')}>
          Dashboard
        </DropdownMenu.Item>

        {isAdmin && (
          <DropdownMenu.Item onClick={() => navigate('/profile?tab=admin')}>
            Admin
          </DropdownMenu.Item>
        )}

        <DropdownMenu.Item onClick={() => navigate('/profile?tab=settings')}>
          Profile
        </DropdownMenu.Item>

        <DropdownMenu.Separator />

        <DropdownMenu.Item
          color="red"
          disabled={isLoggingOut}
          onClick={handleLogout}
        >
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
