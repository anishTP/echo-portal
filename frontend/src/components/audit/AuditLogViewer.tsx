import { useState } from 'react';
import { Button, Select, TextField, Spinner, Badge, Flex, Text } from '@radix-ui/themes';
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

  const getOutcomeBadgeColor = (outcome: string | null): 'green' | 'red' | 'orange' | 'gray' => {
    switch (outcome) {
      case 'success':
        return 'green';
      case 'failure':
        return 'red';
      case 'denied':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getActionBadgeColor = (action: string): 'red' | 'orange' | 'green' | 'blue' | 'gray' => {
    if (action.includes('denied')) return 'red';
    if (action.includes('failed')) return 'orange';
    if (action.includes('approved') || action.includes('granted')) return 'green';
    if (action.includes('created')) return 'blue';
    return 'gray';
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
      <Flex align="center" justify="center" py="9">
        <Spinner size="2" />
        <Text size="2" color="gray" ml="3">Loading audit logs...</Text>
      </Flex>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--gray-6)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: 'var(--gray-12)' }}>Filters</h3>
          {Object.keys(filters).length > 0 && (
            <Button variant="ghost" size="2" onClick={resetFilters}>
              Clear all
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resource Type Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--gray-12)] mb-1">
              Resource Type
            </label>
            <Select.Root
              value={filters.resourceType || 'all'}
              onValueChange={(value) =>
                handleFilterChange('resourceType', value === 'all' ? undefined : value)
              }
            >
              <Select.Trigger placeholder="All" style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                <Select.Item value="branch">Branch</Select.Item>
                <Select.Item value="review">Review</Select.Item>
                <Select.Item value="convergence">Convergence</Select.Item>
                <Select.Item value="user">User</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--gray-12)] mb-1">
              Outcome
            </label>
            <Select.Root
              value={filters.outcome || 'all'}
              onValueChange={(value) =>
                handleFilterChange('outcome', value === 'all' ? undefined : value)
              }
            >
              <Select.Trigger placeholder="All" style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="all">All</Select.Item>
                <Select.Item value="success">Success</Select.Item>
                <Select.Item value="failure">Failure</Select.Item>
                <Select.Item value="denied">Denied</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--gray-12)] mb-1">
              Start Date
            </label>
            <TextField.Root
              type="datetime-local"
              value={filters.startDate?.toISOString().slice(0, 16) || ''}
              onChange={(e) =>
                handleFilterChange(
                  'startDate',
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--gray-6)' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ backgroundColor: 'var(--gray-2)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Outcome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gray-11)', borderBottom: '1px solid var(--gray-6)' }}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'var(--color-background)' }}>
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm"
                    style={{ color: 'var(--gray-11)' }}
                  >
                    No audit logs found matching the current filters.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="cursor-pointer"
                      style={{ borderBottom: '1px solid var(--gray-6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => toggleExpandEntry(entry.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--gray-12)' }}>
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
                              <div className="text-sm font-medium" style={{ color: 'var(--gray-12)' }}>
                                {entry.actor.displayName}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--gray-11)' }}>
                                {entry.actor.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--gray-11)' }}>
                            {entry.actorId}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge color={getActionBadgeColor(entry.action)} variant="soft" size="1" radius="full">
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: 'var(--gray-12)' }}>
                          {entry.resourceType}
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'var(--gray-11)' }}>
                          {entry.resourceId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.outcome && (
                          <Badge color={getOutcomeBadgeColor(entry.outcome)} variant="soft" size="1" radius="full">
                            {entry.outcome}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Button variant="ghost" size="1">
                          {expandedEntry === entry.id ? '−' : '+'}
                        </Button>
                      </td>
                    </tr>
                    {expandedEntry === entry.id && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4" style={{ backgroundColor: 'var(--gray-2)', borderBottom: '1px solid var(--gray-6)' }}>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium" style={{ color: 'var(--gray-11)' }}>
                                  Request ID:
                                </span>{' '}
                                <span className="font-mono text-xs" style={{ color: 'var(--gray-12)' }}>
                                  {entry.requestId || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium" style={{ color: 'var(--gray-11)' }}>
                                  Session ID:
                                </span>{' '}
                                <span className="font-mono text-xs" style={{ color: 'var(--gray-12)' }}>
                                  {entry.sessionId || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium" style={{ color: 'var(--gray-11)' }}>
                                  IP Address:
                                </span>{' '}
                                <span style={{ color: 'var(--gray-12)' }}>
                                  {entry.actorIp || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium" style={{ color: 'var(--gray-11)' }}>
                                  User Agent:
                                </span>{' '}
                                <span className="text-xs" style={{ color: 'var(--gray-12)' }}>
                                  {entry.actorUserAgent || 'N/A'}
                                </span>
                              </div>
                            </div>
                            {Object.keys(entry.metadata as object).length > 0 && (
                              <div>
                                <div className="font-medium mb-2" style={{ color: 'var(--gray-11)' }}>
                                  Metadata:
                                </div>
                                <pre className="p-3 rounded text-xs overflow-x-auto" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--gray-6)' }}>
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
          <div className="px-4 py-3 flex items-center justify-between sm:px-6" style={{ backgroundColor: 'var(--gray-2)', borderTop: '1px solid var(--gray-6)' }}>
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                variant="outline"
                size="2"
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="2"
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={!hasMore && currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--gray-11)' }}>
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="2"
                    onClick={() => onPageChange?.(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="2"
                    onClick={() => onPageChange?.(currentPage + 1)}
                    disabled={!hasMore && currentPage === totalPages}
                  >
                    Next
                  </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
