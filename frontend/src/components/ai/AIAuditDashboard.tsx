import { useState, useEffect, useCallback } from 'react';
import { Button, Badge, TextField, Card, Heading, Text, Flex, Box } from '@radix-ui/themes';
import { api } from '../../services/api.js';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  actorType: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  actor?: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface AuditFilters {
  userId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

/**
 * AIAuditDashboard — admin component for querying AI activity (T048, FR-005)
 *
 * Shows filterable, paginated list of all AI-related audit events.
 */
export function AIAuditDashboard() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({
    userId: '',
    action: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.action) params.set('action', filters.action);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('page', String(filters.page));
      params.set('limit', String(filters.limit));

      const result = await api.get<{
        data: AuditEntry[];
        meta: { total: number; page: number; limit: number };
      }>(`/ai/config/audit?${params.toString()}`);

      setEntries(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const totalPages = Math.ceil(total / filters.limit);

  const getActionBadge = (action: string) => {
    const colors: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'> = {
      'ai.requested': 'blue',
      'ai.generated': 'purple',
      'ai.accepted': 'green',
      'ai.rejected': 'red',
      'ai.cancelled': 'gray',
      'ai.reverted': 'yellow',
      'ai.config_changed': 'blue',
    };
    return (
      <Badge color={colors[action] ?? 'gray'} variant="soft" size="1">
        {action.replace('ai.', '')}
      </Badge>
    );
  };

  return (
    <Card size="3">
      <Heading size="4" mb="4">AI Activity Audit</Heading>

      {/* Filters */}
      <Flex gap="3" mb="4" wrap="wrap" align="end">
        <Box>
          <Text size="1" weight="medium" mb="1" as="label">User ID</Text>
          <TextField.Root
            size="2"
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value, page: 1 }))}
            placeholder="Filter by user..."
          />
        </Box>
        <Box>
          <Text size="1" weight="medium" mb="1" as="label">Action</Text>
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value, page: 1 }))}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent"
          >
            <option value="">All actions</option>
            <option value="ai.requested">Requested</option>
            <option value="ai.generated">Generated</option>
            <option value="ai.accepted">Accepted</option>
            <option value="ai.rejected">Rejected</option>
            <option value="ai.cancelled">Cancelled</option>
            <option value="ai.reverted">Reverted</option>
            <option value="ai.config_changed">Config Changed</option>
          </select>
        </Box>
        <Box>
          <Text size="1" weight="medium" mb="1" as="label">From</Text>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent"
          />
        </Box>
        <Box>
          <Text size="1" weight="medium" mb="1" as="label">To</Text>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent"
          />
        </Box>
      </Flex>

      {/* Error */}
      {error && (
        <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {loading ? (
          <Text size="2" color="gray">Loading audit logs...</Text>
        ) : entries.length === 0 ? (
          <Text size="2" color="gray">No AI audit events found.</Text>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getActionBadge(entry.action)}
                <div>
                  <Text size="2" weight="medium">
                    {entry.actor?.displayName ?? entry.actorId}
                  </Text>
                  <Text size="1" color="gray" as="div">
                    {new Date(entry.timestamp).toLocaleString()}
                  </Text>
                </div>
              </div>
              <div className="text-right">
                <Text size="1" color="gray" as="div">
                  {entry.resourceType}: {entry.resourceId.slice(0, 8)}...
                </Text>
                {entry.metadata?.providerId ? (
                  <Text size="1" color="gray" as="div">
                    Provider: {String(entry.metadata.providerId)}
                  </Text>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Flex justify="between" align="center" mt="4">
          <Text size="1" color="gray">
            Page {filters.page} of {totalPages} ({total} total)
          </Text>
          <Flex gap="2">
            <Button
              size="1"
              variant="outline"
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              size="1"
              variant="outline"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      )}
    </Card>
  );
}
