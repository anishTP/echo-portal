import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AuditEntry } from '../components/common/AuditTrail';
import type { BranchLineage } from '../components/common/LineageViewer';

export interface AuditQueryOptions {
  resourceType?: 'branch' | 'review' | 'convergence' | 'user';
  resourceId?: string;
  actorId?: string;
  actions?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  data: AuditEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResourceType: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}

// Query keys
export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (options: AuditQueryOptions) => [...auditKeys.lists(), options] as const,
  branchHistory: (branchId: string) => [...auditKeys.all, 'branch-history', branchId] as const,
  branchLineage: (branchId: string) => [...auditKeys.all, 'branch-lineage', branchId] as const,
  branchTimeline: (branchId: string) => [...auditKeys.all, 'branch-timeline', branchId] as const,
  myActivity: () => [...auditKeys.all, 'my-activity'] as const,
  stats: (options?: { startDate?: Date; endDate?: Date; resourceType?: string }) =>
    [...auditKeys.all, 'stats', options] as const,
};

/**
 * Hook to query audit logs
 */
export function useAuditLogs(options: AuditQueryOptions = {}) {
  const params = new URLSearchParams();

  if (options.resourceType) params.set('resourceType', options.resourceType);
  if (options.resourceId) params.set('resourceId', options.resourceId);
  if (options.actorId) params.set('actorId', options.actorId);
  if (options.actions?.length) params.set('actions', options.actions.join(','));
  if (options.startDate) params.set('startDate', options.startDate.toISOString());
  if (options.endDate) params.set('endDate', options.endDate.toISOString());
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));

  const queryString = params.toString();

  return useQuery<AuditQueryResult>({
    queryKey: auditKeys.list(options),
    queryFn: () =>
      api.get<AuditQueryResult>(
        `/audit${queryString ? `?${queryString}` : ''}`
      ),
  });
}

/**
 * Hook to get audit history for a branch
 */
export function useBranchHistory(
  branchId: string | undefined,
  options: { limit?: number; includeRelated?: boolean } = {}
) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.includeRelated) params.set('includeRelated', 'true');

  const queryString = params.toString();

  return useQuery<AuditEntry[]>({
    queryKey: auditKeys.branchHistory(branchId || ''),
    queryFn: () =>
      api.get<AuditEntry[]>(
        `/audit/branches/${branchId}/history${queryString ? `?${queryString}` : ''}`
      ),
    enabled: !!branchId,
  });
}

/**
 * Hook to get lineage for a branch
 */
export function useBranchLineage(branchId: string | undefined) {
  return useQuery<BranchLineage>({
    queryKey: auditKeys.branchLineage(branchId || ''),
    queryFn: () => api.get<BranchLineage>(`/audit/branches/${branchId}/lineage`),
    enabled: !!branchId,
  });
}

/**
 * Hook to get state timeline for a branch
 */
export function useBranchTimeline(branchId: string | undefined) {
  return useQuery({
    queryKey: auditKeys.branchTimeline(branchId || ''),
    queryFn: () => api.get(`/audit/branches/${branchId}/timeline`),
    enabled: !!branchId,
  });
}

/**
 * Hook to get current user's activity
 */
export function useMyActivity(options: { limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));

  const queryString = params.toString();

  return useQuery<AuditEntry[]>({
    queryKey: auditKeys.myActivity(),
    queryFn: () =>
      api.get<AuditEntry[]>(`/audit/my-activity${queryString ? `?${queryString}` : ''}`),
  });
}

/**
 * Hook to get audit statistics
 */
export function useAuditStats(
  options: { startDate?: Date; endDate?: Date; resourceType?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.startDate) params.set('startDate', options.startDate.toISOString());
  if (options.endDate) params.set('endDate', options.endDate.toISOString());
  if (options.resourceType) params.set('resourceType', options.resourceType);

  const queryString = params.toString();

  return useQuery<AuditStats>({
    queryKey: auditKeys.stats(options),
    queryFn: () =>
      api.get<AuditStats>(`/audit/stats${queryString ? `?${queryString}` : ''}`),
  });
}

export default useAuditLogs;
