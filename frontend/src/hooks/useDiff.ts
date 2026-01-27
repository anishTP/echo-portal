import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { BranchDiff } from '../components/diff/FileDiffList';

// Query keys
export const diffKeys = {
  all: ['diff'] as const,
  branch: (branchId: string) => [...diffKeys.all, 'branch', branchId] as const,
  summary: (branchId: string) => [...diffKeys.all, 'summary', branchId] as const,
};

export interface DiffSummary {
  added: string[];
  modified: string[];
  deleted: string[];
  total: number;
}

/**
 * Fetch full diff for a branch
 */
async function fetchBranchDiff(branchId: string): Promise<BranchDiff> {
  return api.get<BranchDiff>(`/branches/${branchId}/diff`);
}

/**
 * Fetch diff summary for a branch
 */
async function fetchDiffSummary(branchId: string): Promise<DiffSummary> {
  return api.get<DiffSummary>(`/branches/${branchId}/diff/summary`);
}

/**
 * Hook to fetch the full diff for a branch
 */
export function useBranchDiff(branchId: string | undefined) {
  return useQuery({
    queryKey: diffKeys.branch(branchId || ''),
    queryFn: () => {
      if (!branchId) throw new Error('Branch ID required');
      return fetchBranchDiff(branchId);
    },
    enabled: !!branchId,
  });
}

/**
 * Hook to fetch just the diff summary (file list)
 */
export function useDiffSummary(branchId: string | undefined) {
  return useQuery({
    queryKey: diffKeys.summary(branchId || ''),
    queryFn: () => {
      if (!branchId) throw new Error('Branch ID required');
      return fetchDiffSummary(branchId);
    },
    enabled: !!branchId,
  });
}

export default useBranchDiff;
