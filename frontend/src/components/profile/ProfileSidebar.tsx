import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Text } from '@radix-ui/themes';
import { GearIcon, BellIcon, DashboardIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { useAuth } from '../../context/AuthContext';

type ProfileTab = 'dashboard' | 'notifications' | 'settings' | 'admin';

interface NavItem {
  tab: ProfileTab;
  label: string;
  icon: typeof GearIcon;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { tab: 'settings', label: 'Profile', icon: GearIcon },
  { tab: 'notifications', label: 'Notifications', icon: BellIcon },
  { tab: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { tab: 'admin', label: 'Admin', icon: LockClosedIcon, adminOnly: true },
];

export function ProfileSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const activeTab = (searchParams.get('tab') as ProfileTab) || 'dashboard';
  const isAdmin = hasRole?.('administrator') ?? false;

  const visibleItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  const handleTabClick = (tab: ProfileTab) => {
    setSearchParams({ tab });
  };

  return (
    <Flex
      direction="column"
      gap="1"
      style={{
        width: 180,
        minWidth: 180,
        paddingTop: 16,
        paddingLeft: 16,
        paddingRight: 16,
        borderRight: '1px solid var(--gray-5)',
      }}
    >
      {visibleItems.map(({ tab, label, icon: Icon }) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? 'var(--accent-3)' : 'transparent',
              color: isActive ? 'var(--accent-11)' : 'var(--gray-11)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--gray-3)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon width={16} height={16} />
            <Text size="2" weight={isActive ? 'bold' : 'regular'}>
              {label}
            </Text>
          </button>
        );
      })}
    </Flex>
  );
}
