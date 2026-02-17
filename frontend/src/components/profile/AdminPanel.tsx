import { useState, useEffect } from 'react';
import { Flex, Heading, Text, Button, Badge, Callout, Spinner } from '@radix-ui/themes';
import { PersonIcon, GearIcon, FileTextIcon, ActivityLogIcon, BellIcon } from '@radix-ui/react-icons';
import { useAuth } from '../../context/AuthContext';
import { RoleDisplayNames } from '@echo-portal/shared';
import { RoleChangeDialog } from '../users';
import { AIConfigPanel } from '../ai/AIConfigPanel';
import { AIContextDocuments } from '../ai/AIContextDocuments';
import { AIAuditDashboard } from '../ai/AIAuditDashboard';
import { NotificationMetrics } from '../notification/NotificationMetrics';
import { userService } from '../../services/auth';
import type { User } from '@echo-portal/shared';

const tabs = [
  { id: 'users', label: 'Users', icon: PersonIcon },
  { id: 'config', label: 'Configuration', icon: GearIcon },
  { id: 'context', label: 'Context Documents', icon: FileTextIcon },
  { id: 'audit', label: 'Activity Audit', icon: ActivityLogIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function AdminPanel() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole?.('administrator') ?? false;
  const [activeTab, setActiveTab] = useState<TabId>('users');

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.listUsers();
      setUsers((data.users as unknown as User[]) || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      fetchUsers();
    }
  }, [isAdmin, activeTab]);

  const handleOpenRoleDialog = (u: User) => {
    setSelectedUser(u);
    setIsRoleDialogOpen(true);
  };

  const handleCloseRoleDialog = () => {
    setIsRoleDialogOpen(false);
    setSelectedUser(null);
  };

  const handleRoleChangeSuccess = () => {
    fetchUsers();
  };

  const handleUnlockUser = async (userId: string) => {
    setUnlockingUserId(userId);
    try {
      await userService.unlockAccount(userId);
      await fetchUsers();
    } catch (err) {
      console.error('Error unlocking user:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlock user');
    } finally {
      setUnlockingUserId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (u: User) => {
    if (!u.isActive) {
      return <Badge color="red" variant="soft" radius="full" size="1">Inactive</Badge>;
    }
    return <Badge color="green" variant="soft" radius="full" size="1">Active</Badge>;
  };

  const getRoleBadge = (roles: string[]) => {
    const primaryRole = roles[0] || 'viewer';
    const badgeColors: Record<string, 'gray' | 'blue' | 'purple' | 'red'> = {
      viewer: 'gray',
      contributor: 'blue',
      reviewer: 'purple',
      administrator: 'red',
    };
    const color = badgeColors[primaryRole] || 'gray';
    return (
      <Badge color={color} variant="soft" radius="full" size="1">
        {RoleDisplayNames[primaryRole] || primaryRole}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <Flex direction="column" align="center" py="9" gap="3">
        <Heading size="4" color="gray">Access Denied</Heading>
        <Text size="2" color="gray">
          You need administrator privileges to access admin settings.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="4">
      <Heading size="5">Admin</Heading>
      <Text size="2" color="gray">
        Manage users, AI configuration, and system settings
      </Text>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Admin tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'users' && (
        <div>
          {error && (
            <Callout.Root color="red" size="2" className="mb-4">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                All Users ({users.length})
              </h3>

              {isLoading ? (
                <div className="text-center py-12">
                  <Spinner size="3" />
                  <p className="mt-2 text-sm text-gray-500">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {u.avatarUrl ? (
                                <img className="h-10 w-10 rounded-full" src={u.avatarUrl} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-gray-500 font-medium text-sm">
                                    {u.displayName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{u.displayName}</div>
                                <div className="text-sm text-gray-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(u.roles)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(u)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(u.lastLoginAt)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button
                              variant="ghost"
                              size="2"
                              onClick={() => handleOpenRoleDialog(u)}
                              disabled={user?.id === u.id}
                              title={user?.id === u.id ? 'Cannot change your own role' : 'Change user role'}
                              className="mr-4"
                            >
                              Change Role
                            </Button>
                            {!u.isActive && (
                              <Button
                                variant="ghost"
                                size="2"
                                color="green"
                                onClick={() => handleUnlockUser(u.id)}
                                disabled={unlockingUserId === u.id}
                              >
                                {unlockingUserId === u.id ? 'Unlocking...' : 'Unlock'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {selectedUser && (
            <RoleChangeDialog
              user={selectedUser}
              isOpen={isRoleDialogOpen}
              onClose={handleCloseRoleDialog}
              onSuccess={handleRoleChangeSuccess}
            />
          )}
        </div>
      )}
      {activeTab === 'config' && <AIConfigPanel />}
      {activeTab === 'context' && <AIContextDocuments />}
      {activeTab === 'audit' && <AIAuditDashboard />}
      {activeTab === 'notifications' && <NotificationMetrics />}
    </Flex>
  );
}
