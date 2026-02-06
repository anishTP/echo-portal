import { useQuery } from '@tanstack/react-query';
import { comparisonService } from '../services/comparisonService';
import type { BranchComparison, FileDiff } from '@echo-portal/shared';

// Query key factory for comparison queries
export const comparisonKeys = {
  all: ['comparison'] as const,
  branch: (branchId: string) => [...comparisonKeys.all, 'branch', branchId] as const,
  branchWithSnapshot: (branchId: string, snapshotId?: string) =>
    [...comparisonKeys.branch(branchId), { snapshotId }] as const,
  file: (branchId: string, filePath: string, snapshotId?: string) =>
    [...comparisonKeys.branch(branchId), 'file', filePath, { snapshotId }] as const,
};

/**
 * Hook to fetch branch comparison
 * Returns the diff between the branch head and its base state
 */
export function useComparison(branchId: string | undefined, snapshotId?: string) {
  return useQuery({
    queryKey: comparisonKeys.branchWithSnapshot(branchId || '', snapshotId),
    queryFn: async (): Promise<BranchComparison> => {
      if (!branchId) throw new Error('Branch ID required');
      return comparisonService.getBranchComparison(branchId, snapshotId);
    },
    enabled: !!branchId,
    staleTime: 30000, // Consider comparison fresh for 30 seconds
  });
}

/**
 * Hook to fetch a specific file diff
 * Useful for lazy-loading individual file diffs in large comparisons
 */
export function useFileDiff(
  branchId: string | undefined,
  filePath: string | undefined,
  snapshotId?: string
) {
  return useQuery({
    queryKey: comparisonKeys.file(branchId || '', filePath || '', snapshotId),
    queryFn: async (): Promise<FileDiff> => {
      if (!branchId || !filePath) throw new Error('Branch ID and file path required');
      return comparisonService.getFileDiff(branchId, filePath, snapshotId);
    },
    enabled: !!branchId && !!filePath,
    staleTime: 30000,
  });
}

export default useComparison;
