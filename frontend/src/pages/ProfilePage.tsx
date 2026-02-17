import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flex } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';
import { ProfileSidebar } from '../components/profile/ProfileSidebar';
import { DashboardPanel } from '../components/profile/DashboardPanel';
import { NotificationsPanel } from '../components/profile/NotificationsPanel';
import { AccountSettingsPanel } from '../components/profile/AccountSettingsPanel';

type ProfileTab = 'dashboard' | 'notifications' | 'settings';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const tab = (searchParams.get('tab') as ProfileTab) || 'dashboard';

  if (!isAuthenticated || !user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <Flex style={{ minHeight: 'calc(100vh - 64px)' }}>
      <ProfileSidebar />
      <div style={{ flex: 1, minWidth: 0, padding: '24px 32px' }}>
        {tab === 'dashboard' && <DashboardPanel />}
        {tab === 'notifications' && <NotificationsPanel />}
        {tab === 'settings' && <AccountSettingsPanel />}
      </div>
    </Flex>
  );
}
