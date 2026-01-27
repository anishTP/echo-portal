import { useState } from 'react';
import type { AuditEntryWithActor } from '@echo-portal/shared';

interface AuditLogViewerProps {
  entries: AuditEntryWithActor[];
  isLoading?: boolean;
  onFilterChange?: (filters: AuditFilters) => void;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface AuditFilters {
  resourceType?: 'branch' | 'review' | 'convergence' | 'user';
  resourceId?: string;
  actorId?: string;
  actions?: string[];
  startDate?: Date;
  endDate?: Date;
  outcome?: 'success' | 'failure' | 'denied';
}

/**
 * T088: AuditLogViewer Component
 *
 * Filterable table displaying audit log entries with:
 * - Actor information (user who performed the action)
 * - Action type
 * - Resource type and ID
 * - Outcome (success/failure/denied)
 * - Timestamp
 * - Metadata details
 */
export function AuditLogViewer({
  entries,
  isLoading = false,
  onFilterChange,
  onPageChange,
  currentPage = 1,
  totalPages = 1,
  hasMore = false,
}: AuditLogViewerProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const handleFilterChange = (key: keyof AuditFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const resetFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  const getOutcomeBadgeStyle = (outcome: string | null) => {
    switch (outcome) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'denied':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionBadgeStyle = (action: string) => {
    if (action.includes('denied')) return 'bg-red-100 text-red-800';
    if (action.includes('failed')) return 'bg-orange-100 text-orange-800';
    if (action.includes('approved') || action.includes('granted')) return 'bg-green-100 text-green-800';
    if (action.includes('created')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const toggleExpandEntry = (entryId: string) => {
    setExpandedEntry(expandedEntry === entryId ? null : entryId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading audit logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Filters</h3>
          {Object.keys(filters).length > 0 && (
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resource Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Resource Type
            </label>
            <select
              value={filters.resourceType || ''}
              onChange={(e) =>
                handleFilterChange('resourceType', e.target.value || undefined)
              }
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">All</option>
              <option value="branch">Branch</option>
              <option value="review">Review</option>
              <option value="convergence">Convergence</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Outcome
            </label>
            <select
              value={filters.outcome || ''}
              onChange={(e) =>
                handleFilterChange('outcome', e.target.value || undefined)
              }
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={filters.startDate?.toISOString().slice(0, 16) || ''}
              onChange={(e) =>
                handleFilterChange(
                  'startDate',
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outcome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No audit logs found matching the current filters.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpandEntry(entry.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.actor ? (
                          <div className="flex items-center">
                            {entry.actor.avatarUrl && (
                              <img
                                src={entry.actor.avatarUrl}
                                alt={entry.actor.displayName}
                                className="h-8 w-8 rounded-full mr-2"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {entry.actor.displayName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {entry.actor.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {entry.actorId}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeStyle(
                            entry.action
                          )}`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {entry.resourceType}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {entry.resourceId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.outcome && (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOutcomeBadgeStyle(
                              entry.outcome
                            )}`}
                          >
                            {entry.outcome}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button className="text-blue-600 hover:text-blue-900">
                          {expandedEntry === entry.id ? '−' : '+'}
                        </button>
                      </td>
                    </tr>
                    {expandedEntry === entry.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">
                                  Request ID:
                                </span>{' '}
                                <span className="text-gray-900 font-mono text-xs">
                                  {entry.requestId || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Session ID:
                                </span>{' '}
                                <span className="text-gray-900 font-mono text-xs">
                                  {entry.sessionId || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  IP Address:
                                </span>{' '}
                                <span className="text-gray-900">
                                  {entry.actorIp || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  User Agent:
                                </span>{' '}
                                <span className="text-gray-900 text-xs">
                                  {entry.actorUserAgent || 'N/A'}
                                </span>
                              </div>
                            </div>
                            {Object.keys(entry.metadata as object).length > 0 && (
                              <div>
                                <div className="font-medium text-gray-700 mb-2">
                                  Metadata:
                                </div>
                                <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || hasMore) && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={!hasMore && currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav
                  className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => onPageChange?.(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => onPageChange?.(currentPage + 1)}
                    disabled={!hasMore && currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
