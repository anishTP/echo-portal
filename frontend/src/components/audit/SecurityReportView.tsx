import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { ReloadIcon } from '@radix-ui/react-icons';
import type { AuditEntryWithActor } from '@echo-portal/shared';

interface SecurityReportViewProps {
  failedLogins?: FailedLoginReport;
  permissionDenials?: PermissionDenialReport;
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface FailedLoginReport {
  entries: AuditEntryWithActor[];
  summary: {
    totalFailedAttempts: number;
    uniqueUsers: number;
    lockedAccounts: number;
  };
}

interface PermissionDenialReport {
  entries: AuditEntryWithActor[];
  aggregated: Array<{
    actorId: string;
    action: string;
    resourceType: string;
    count: number;
    lastAttempt: Date;
  }>;
  summary: {
    totalDenials: number;
    uniqueActors: number;
    mostDeniedAction: string | null;
  };
}

/**
 * T089: SecurityReportView Component
 *
 * Displays security-related audit reports:
 * - Failed login attempts (security monitoring)
 * - Permission denials (aggregated by actor/action)
 * - Summary statistics and alerts
 */
export function SecurityReportView({
  failedLogins,
  permissionDenials,
  isLoading = false,
  onRefresh,
}: SecurityReportViewProps) {
  const [activeTab, setActiveTab] = useState<'failed-logins' | 'permission-denials'>(
    'failed-logins'
  );

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        <span className="ml-3 text-gray-600">Loading security reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security Reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monitor authentication failures and permission denials
          </p>
        </div>
        <Button variant="outline" size="2" onClick={onRefresh}>
          <ReloadIcon />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Failed Logins Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Failed Login Attempts
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {failedLogins?.summary.totalFailedAttempts || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Locked Accounts Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Locked Accounts
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {failedLogins?.summary.lockedAccounts || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Permission Denials Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Permission Denials
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {permissionDenials?.summary.totalDenials || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex gap-2 p-2">
            <Button
              variant={activeTab === 'failed-logins' ? 'solid' : 'ghost'}
              size="2"
              color={activeTab === 'failed-logins' ? 'red' : 'gray'}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('failed-logins')}
            >
              Failed Login Attempts ({failedLogins?.entries.length || 0})
            </Button>
            <Button
              variant={activeTab === 'permission-denials' ? 'solid' : 'ghost'}
              size="2"
              color={activeTab === 'permission-denials' ? 'orange' : 'gray'}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('permission-denials')}
            >
              Permission Denials ({permissionDenials?.entries.length || 0})
            </Button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'failed-logins' && (
            <div className="space-y-4">
              {failedLogins?.entries && failedLogins.entries.length > 0 ? (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                          Timestamp
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          User
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          IP Address
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Reason
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {failedLogins.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900">
                            {formatTimestamp(entry.timestamp)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {entry.actor ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  {entry.actor.displayName}
                                </div>
                                <div className="text-gray-500">
                                  {entry.actor.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500">{entry.actorId}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {entry.actorIp || 'N/A'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {(entry.metadata as any)?.reason || 'Invalid credentials'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                entry.action === 'auth.locked'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {entry.action === 'auth.locked' ? 'Locked' : 'Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2">No failed login attempts found</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'permission-denials' && (
            <div className="space-y-6">
              {/* Aggregated View */}
              {permissionDenials?.aggregated &&
                permissionDenials.aggregated.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Top Denied Actions
                    </h3>
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                              Actor
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Action
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Resource Type
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Count
                            </th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                              Last Attempt
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {permissionDenials.aggregated.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                {item.actorId.slice(0, 8)}...
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                <span className="font-mono text-xs">
                                  {item.action}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {item.resourceType}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {item.count}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                {formatTimestamp(item.lastAttempt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Most Denied Action */}
              {permissionDenials?.summary.mostDeniedAction && (
                <div className="rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Most Frequently Denied Action
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <code className="bg-yellow-100 px-2 py-1 rounded">
                          {permissionDenials.summary.mostDeniedAction}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(!permissionDenials?.entries ||
                permissionDenials.entries.length === 0) && (
                <div className="text-center py-12 text-gray-500">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2">No permission denials found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
