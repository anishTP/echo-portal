import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService, type BranchListParams, type BranchResponse } from '../services/branchService';
import { useBranchStore } from '../stores/branchStore';
import { useUIStore } from '../stores/index';
import type { BranchCreateInput, BranchUpdateInput } from '@echo-portal/shared';

// Query keys
export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (params: BranchListParams) => [...branchKeys.lists(), params] as const,
  details: () => [...branchKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchKeys.details(), id] as const,
  myBranches: () => [...branchKeys.all, 'my'] as const,
  reviewBranches: () => [...branchKeys.all, 'reviews'] as const,
};

/**
 * Hook to fetch a single branch by ID
 */
export function useBranch(id: string | undefined) {
  const setCurrentBranch = useBranchStore((s) => s.setCurrentBranch);

  return useQuery({
    queryKey: branchKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Branch ID required');
      const branch = await branchService.getById(id);
      setCurrentBranch(branch);
      return branch;
    },
    enabled: !!id,
  });
}

/**
 * Hook to list branches with filtering
 */
export function useBranchList(params: BranchListParams = {}) {
  const setPagination = useBranchStore((s) => s.setPagination);

  return useQuery({
    queryKey: branchKeys.list(params),
    queryFn: async () => {
      const response = await branchService.list(params);
      setPagination(response.meta);
      return response;
    },
  });
}

/**
 * Hook to get current user's branches
 */
export function useMyBranches(includeArchived = false) {
  const setMyBranches = useBranchStore((s) => s.setMyBranches);

  return useQuery({
    queryKey: [...branchKeys.myBranches(), { includeArchived }],
    queryFn: async () => {
      const branches = await branchService.getMyBranches(includeArchived);
      setMyBranches(branches);
      return branches;
    },
  });
}

/**
 * Hook to get branches where user is a reviewer
 */
export function useReviewBranches() {
  const setReviewBranches = useBranchStore((s) => s.setReviewBranches);

  return useQuery({
    queryKey: branchKeys.reviewBranches(),
    queryFn: async () => {
      const branches = await branchService.getReviewBranches();
      setReviewBranches(branches);
      return branches;
    },
  });
}

/**
 * Hook to create a new branch
 */
export function useCreateBranch() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const setIsCreating = useBranchStore((s) => s.setIsCreating);

  return useMutation({
    mutationFn: (input: BranchCreateInput) => {
      setIsCreating(true);
      return branchService.create(input);
    },
    onSuccess: (branch) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });

      addNotification({
        type: 'success',
        title: 'Branch created',
        message: `Branch "${branch.name}" has been created.`,
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to create branch',
        message: error.message,
      });
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });
}

/**
 * Hook to update a branch
 */
export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateBranchInLists = useBranchStore((s) => s.updateBranchInLists);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchUpdateInput }) =>
      branchService.update(id, input),
    onSuccess: (branch) => {
      // Update in cache
      queryClient.setQueryData(branchKeys.detail(branch.id), branch);
      updateBranchInLists(branch);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });

      addNotification({
        type: 'success',
        title: 'Branch updated',
        message: `Branch "${branch.name}" has been updated.`,
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to update branch',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to delete a branch
 */
export function useDeleteBranch() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const removeBranchFromLists = useBranchStore((s) => s.removeBranchFromLists);

  return useMutation({
    mutationFn: (id: string) => branchService.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: branchKeys.detail(id) });
      removeBranchFromLists(id);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });

      addNotification({
        type: 'success',
        title: 'Branch deleted',
        message: 'Branch has been deleted.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to delete branch',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to add reviewers to a branch
 */
export function useAddReviewers() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateBranchInLists = useBranchStore((s) => s.updateBranchInLists);

  return useMutation({
    mutationFn: ({ id, reviewerIds }: { id: string; reviewerIds: string[] }) =>
      branchService.addReviewers(id, reviewerIds),
    onSuccess: (branch) => {
      queryClient.setQueryData(branchKeys.detail(branch.id), branch);
      updateBranchInLists(branch);

      addNotification({
        type: 'success',
        title: 'Reviewers added',
        message: 'Reviewers have been added to the branch.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to add reviewers',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to remove a reviewer from a branch
 */
export function useRemoveReviewer() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateBranchInLists = useBranchStore((s) => s.updateBranchInLists);

  return useMutation({
    mutationFn: ({ id, reviewerId }: { id: string; reviewerId: string }) =>
      branchService.removeReviewer(id, reviewerId),
    onSuccess: (branch) => {
      queryClient.setQueryData(branchKeys.detail(branch.id), branch);
      updateBranchInLists(branch);

      addNotification({
        type: 'success',
        title: 'Reviewer removed',
        message: 'Reviewer has been removed from the branch.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to remove reviewer',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to publish a branch (publisher/admin only)
 */
export function usePublishBranch() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateBranchInLists = useBranchStore((s) => s.updateBranchInLists);

  return useMutation({
    mutationFn: (id: string) => branchService.publish(id),
    onSuccess: (result) => {
      const branch = result.branch;
      if (branch) {
        queryClient.setQueryData(branchKeys.detail(branch.id), branch);
        updateBranchInLists(branch);
      }

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });

      addNotification({
        type: 'success',
        title: 'Branch published',
        message: 'Branch has been published successfully.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to publish branch',
        message: error.message,
      });
    },
  });
}

export default useBranch;
