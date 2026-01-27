import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuditLogViewer, SecurityReportView } from '../components/audit';
import type {
  AuditEntryWithActor,
  AuditQueryOptions,
  FailedLoginReport,
  PermissionDenialReport,
} from '@echo-portal/shared';

/**
 * T090: Audit Log Page
 *
 * Admin-only page for viewing audit logs and security reports.
 * Integrates AuditLogViewer and SecurityReportView components.
 */
export default function AuditLog() {
  const { user, hasRole } = useAuth();
  const [activeView, setActiveView] = useState<'logs' | 'security'>('logs');
  const [auditEntries, setAuditEntries] = useState<AuditEntryWithActor[]>([]);
  const [failedLogins, setFailedLogins] = useState<FailedLoginReport | undefined>();
  const [permissionDenials, setPermissionDenials] = useState<PermissionDenialReport | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Check admin access
  const isAdmin = hasRole?.('administrator') ?? false;

  // Fetch audit logs
  const fetchAuditLogs = async (options: AuditQueryOptions = {}) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (options.resourceType) queryParams.set('resourceType', options.resourceType);
      if (options.resourceId) queryParams.set('resourceId', options.resourceId);
      if (options.actorId) queryParams.set('actorId', options.actorId);
      if (options.actions) queryParams.set('actions', options.actions.join(','));
      if (options.startDate) queryParams.set('startDate', options.startDate.toISOString());
      if (options.endDate) queryParams.set('endDate', options.endDate.toISOString());
      if (options.page) queryParams.set('page', options.page.toString());
      if (options.limit) queryParams.set('limit', options.limit.toString());

      const response = await fetch(`/api/v1/audit?${queryParams.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setAuditEntries(data.entries || []);
      setTotalPages(Math.ceil(data.total / data.limit) || 1);
      setHasMore(data.hasMore || false);
      setCurrentPage(data.page || 1);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch security reports
  const fetchSecurityReports = async () => {
    setIsLoading(true);
    try {
      // Fetch failed logins report
      const failedLoginsResponse = await fetch('/api/v1/audit/failed-logins', {
        credentials: 'include',
      });
      if (failedLoginsResponse.ok) {
        const failedLoginsData = await failedLoginsResponse.json();
        setFailedLogins(failedLoginsData);
      }

      // Fetch permission denials report
      const permissionDenialsResponse = await fetch('/api/v1/audit/permission-denials', {
        credentials: 'include',
      });
      if (permissionDenialsResponse.ok) {
        const permissionDenialsData = await permissionDenialsResponse.json();
        setPermissionDenials(permissionDenialsData);
      }
    } catch (error) {
      console.error('Error fetching security reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      if (activeView === 'logs') {
        fetchAuditLogs({ limit: 50 });
      } else {
        fetchSecurityReports();
      }
    }
  }, [isAdmin, activeView]);

  // Handle filter changes
  const handleFilterChange = (filters: AuditQueryOptions) => {
    fetchAuditLogs({ ...filters, page: 1, limit: 50 });
  };

  // Handle page changes
  const handlePageChange = (page: number) => {
    fetchAuditLogs({ page, limit: 50 });
  };

  // Handle security report refresh
  const handleSecurityRefresh = () => {
    fetchSecurityReports();
  };

  // Unauthorized access
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <Link
                to="/"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
              <p className="mt-1 text-sm text-gray-500">
                You need administrator privileges to access audit logs.
              </p>
              <div className="mt-6">
                <Link
                  to="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Return to Dashboard
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
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="mt-1 text-sm text-gray-500">
                View system activity and security events
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Logged in as {user?.displayName || user?.email}
              </span>
              <Link
                to="/"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* View Selector */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveView('logs')}
                  className={`${
                    activeView === 'logs'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <svg
                    className="inline-block mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Activity Logs
                </button>
                <button
                  onClick={() => setActiveView('security')}
                  className={`${
                    activeView === 'security'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <svg
                    className="inline-block mr-2 h-5 w-5"
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
                  Security Reports
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          {activeView === 'logs' ? (
            <AuditLogViewer
              entries={auditEntries}
              isLoading={isLoading}
              onFilterChange={handleFilterChange}
              onPageChange={handlePageChange}
              currentPage={currentPage}
              totalPages={totalPages}
              hasMore={hasMore}
            />
          ) : (
            <SecurityReportView
              failedLogins={failedLogins}
              permissionDenials={permissionDenials}
              isLoading={isLoading}
              onRefresh={handleSecurityRefresh}
            />
          )}
        </div>
      </main>
    </div>
  );
}
