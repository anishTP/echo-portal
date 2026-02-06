import { useQuery } from '@tanstack/react-query';
import { comparisonService } from '../services/comparisonService';
import type { BranchComparison, ContentComparisonStats } from '@echo-portal/shared';

export const contentComparisonKeys = {
  all: ['content-comparison'] as const,
  comparison: (branchId: string) => [...contentComparisonKeys.all, 'full', branchId] as const,
  stats: (branchId: string) => [...contentComparisonKeys.all, 'stats', branchId] as const,
};

/**
 * Hook to fetch full DB-backed content comparison for diff rendering
 */
export function useContentComparison(branchId: string | undefined) {
  return useQuery({
    queryKey: contentComparisonKeys.comparison(branchId || ''),
    queryFn: async (): Promise<BranchComparison> => {
      if (!branchId) throw new Error('Branch ID required');
      return comparisonService.getContentComparison(branchId);
    },
    enabled: !!branchId,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch lightweight content comparison stats for sidebar badges
 */
export function useContentComparisonStats(branchId: string | undefined) {
  return useQuery({
    queryKey: contentComparisonKeys.stats(branchId || ''),
    queryFn: async (): Promise<ContentComparisonStats> => {
      if (!branchId) throw new Error('Branch ID required');
      return comparisonService.getContentComparisonStats(branchId);
    },
    enabled: !!branchId,
    staleTime: 30000,
  });
}
