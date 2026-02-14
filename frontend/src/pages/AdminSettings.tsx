import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Badge, Callout, Spinner } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';
import { RoleDisplayNames } from '@echo-portal/shared';
import { RoleChangeDialog } from '../components/users';
import { AIConfigPanel } from '../components/ai/AIConfigPanel';
import { AIContextDocuments } from '../components/ai/AIContextDocuments';
import { AIAuditDashboard } from '../components/ai/AIAuditDashboard';
import { NotificationMetrics } from '../components/notification/NotificationMetrics';
import { PersonIcon, GearIcon, FileTextIcon, ActivityLogIcon, BellIcon } from '@radix-ui/react-icons';
import { userService } from '../services/auth';
import type { User } from '@echo-portal/shared';

const tabs = [
  { id: 'users', label: 'Users', icon: PersonIcon },
  { id: 'config', label: 'Configuration', icon: GearIcon },
  { id: 'context', label: 'Context Documents', icon: FileTextIcon },
  { id: 'audit', label: 'Activity Audit', icon: ActivityLogIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
] as const;

type TabId = (typeof tabs)[number]['id'];

/**
 * Admin Settings page — unified admin page combining user management
 * and AI configuration/audit into a single tabbed interface.
 */
export default function AdminSettings() {
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

  // Fetch users
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

  // Fetch users when switching to users tab
  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      fetchUsers();
    }
  }, [isAdmin, activeTab]);

  // Handle role change dialog
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

  // Handle user unlock
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

  // Format date
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

  // Get status badge
  const getStatusBadge = (u: User) => {
    if (!u.isActive) {
      return <Badge color="red" variant="soft" radius="full" size="1">Inactive</Badge>;
    }
    return <Badge color="green" variant="soft" radius="full" size="1">Active</Badge>;
  };

  // Get role badge
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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
              <p className="mt-1 text-sm text-gray-500">
                You need administrator privileges to access admin settings.
              </p>
              <div className="mt-6">
                <Link
                  to="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Return to Library
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage users, AI configuration, and system settings
              </p>
            </div>
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Library
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Tab bar */}
          <div className="border-b border-gray-200 mb-6">
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
                  <Callout.Icon>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Callout.Icon>
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
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">No users found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Login
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {u.avatarUrl ? (
                                    <img
                                      className="h-10 w-10 rounded-full"
                                      src={u.avatarUrl}
                                      alt=""
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-gray-500 font-medium text-sm">
                                        {u.displayName.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {u.displayName}
                                    </div>
                                    <div className="text-sm text-gray-500">{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getRoleBadge(u.roles)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(u)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(u.lastLoginAt)}
                              </td>
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
        </div>
      </main>
    </div>
  );
}
