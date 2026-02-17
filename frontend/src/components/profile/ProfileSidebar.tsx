import { useSearchParams } from 'react-router-dom';
import { Flex, Text } from '@radix-ui/themes';
import { GearIcon, BellIcon, DashboardIcon } from '@radix-ui/react-icons';

type ProfileTab = 'dashboard' | 'notifications' | 'settings';

const navItems: { tab: ProfileTab; label: string; icon: typeof GearIcon }[] = [
  { tab: 'settings', label: 'Profile', icon: GearIcon },
  { tab: 'notifications', label: 'Notifications', icon: BellIcon },
  { tab: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
];

export function ProfileSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as ProfileTab) || 'dashboard';

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
      {navItems.map(({ tab, label, icon: Icon }) => {
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
