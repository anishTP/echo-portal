import type { QueryClient } from '@tanstack/react-query';
import type { BranchListParams } from '../services/branchService';
import type { ReviewListParams } from '../services/reviewService';

// Branch query keys
export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (params: BranchListParams) => [...branchKeys.lists(), params] as const,
  details: () => [...branchKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchKeys.details(), id] as const,
  myBranches: () => [...branchKeys.all, 'my'] as const,
  reviewBranches: () => [...branchKeys.all, 'reviews'] as const,
};

// Review query keys
export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  list: (params: ReviewListParams) => [...reviewKeys.lists(), params] as const,
  details: () => [...reviewKeys.all, 'detail'] as const,
  detail: (id: string) => [...reviewKeys.details(), id] as const,
  myReviews: () => [...reviewKeys.all, 'my'] as const,
  branchReviews: (branchId: string) =>
    [...reviewKeys.all, 'branch', branchId] as const,
  branchStats: (branchId: string) =>
    [...reviewKeys.all, 'branch', branchId, 'stats'] as const,
  comments: (id: string) => [...reviewKeys.all, id, 'comments'] as const,
};

/**
 * Invalidate all dashboard-related queries after any workflow transition.
 * Call this from every mutation that changes branch state or review status.
 */
export async function invalidateWorkflowQueries(
  queryClient: QueryClient,
  branchId?: string
) {
  // Invalidate and refetch list queries
  queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });
  queryClient.invalidateQueries({ queryKey: branchKeys.reviewBranches() });
  queryClient.invalidateQueries({ queryKey: reviewKeys.myReviews() });
  queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
  if (branchId) {
    // Small delay to ensure database transaction is fully committed and visible
    await new Promise(resolve => setTimeout(resolve, 100));
    // For the specific branch, refetch immediately to ensure UI updates
    await queryClient.refetchQueries({ queryKey: branchKeys.detail(branchId) });
    queryClient.invalidateQueries({ queryKey: reviewKeys.branchReviews(branchId) });
    queryClient.invalidateQueries({ queryKey: reviewKeys.branchStats(branchId) });
  }
}
