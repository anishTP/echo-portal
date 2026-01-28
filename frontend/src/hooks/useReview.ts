import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reviewService,
  type ReviewListParams,
} from '../services/reviewService';
import { useWorkflowStore } from '../stores/workflowStore';
import { useUIStore } from '../stores/index';
import { reviewKeys, invalidateWorkflowQueries } from './queryKeys';

// Re-export for existing consumers
export { reviewKeys } from './queryKeys';

/**
 * Hook to fetch a single review by ID
 */
export function useReview(id: string | undefined) {
  const setCurrentReview = useWorkflowStore((s) => s.setCurrentReview);

  return useQuery({
    queryKey: reviewKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Review ID required');
      const review = await reviewService.getById(id);
      setCurrentReview(review);
      return review;
    },
    enabled: !!id,
  });
}

/**
 * Hook to list reviews with filtering
 */
export function useReviewList(params: ReviewListParams = {}) {
  const setPagination = useWorkflowStore((s) => s.setPagination);

  return useQuery({
    queryKey: reviewKeys.list(params),
    queryFn: async () => {
      const response = await reviewService.list(params);
      setPagination(response.meta);
      return response;
    },
  });
}

/**
 * Hook to get current user's assigned reviews
 */
export function useMyReviews(activeOnly = false) {
  const setActiveReviews = useWorkflowStore((s) => s.setActiveReviews);

  return useQuery({
    queryKey: [...reviewKeys.myReviews(), { activeOnly }],
    queryFn: async () => {
      const reviews = await reviewService.getMyReviews(activeOnly);
      if (activeOnly) {
        setActiveReviews(reviews);
      }
      return reviews;
    },
  });
}

/**
 * Hook to get reviews for a specific branch
 */
export function useBranchReviews(branchId: string | undefined) {
  const setReviews = useWorkflowStore((s) => s.setReviews);

  return useQuery({
    queryKey: reviewKeys.branchReviews(branchId || ''),
    queryFn: async () => {
      if (!branchId) throw new Error('Branch ID required');
      const reviews = await reviewService.getByBranch(branchId);
      setReviews(reviews);
      return reviews;
    },
    enabled: !!branchId,
  });
}

/**
 * Hook to get review statistics for a branch
 */
export function useBranchReviewStats(branchId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.branchStats(branchId || ''),
    queryFn: async () => {
      if (!branchId) throw new Error('Branch ID required');
      return reviewService.getBranchStats(branchId);
    },
    enabled: !!branchId,
  });
}

/**
 * Hook to request a review
 */
export function useRequestReview() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const addReview = useWorkflowStore((s) => s.addReview);

  return useMutation({
    mutationFn: ({ branchId, reviewerId }: { branchId: string; reviewerId: string }) =>
      reviewService.create(branchId, reviewerId),
    onSuccess: (review) => {
      addReview(review);
      invalidateWorkflowQueries(queryClient, review.branchId);

      addNotification({
        type: 'success',
        title: 'Review requested',
        message: 'Review request has been sent.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to request review',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to start a review
 */
export function useStartReview() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateReview = useWorkflowStore((s) => s.updateReview);

  return useMutation({
    mutationFn: (id: string) => reviewService.start(id),
    onSuccess: (review) => {
      updateReview(review);
      queryClient.setQueryData(reviewKeys.detail(review.id), review);
      invalidateWorkflowQueries(queryClient, review.branchId);

      addNotification({
        type: 'success',
        title: 'Review started',
        message: 'You have started reviewing this branch.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to start review',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to approve a review
 */
export function useApproveReview() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateReview = useWorkflowStore((s) => s.updateReview);
  const setIsSubmittingReview = useWorkflowStore((s) => s.setIsSubmittingReview);

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      setIsSubmittingReview(true);
      return reviewService.approve(id, reason);
    },
    onSuccess: (review) => {
      updateReview(review);
      queryClient.setQueryData(reviewKeys.detail(review.id), review);
      invalidateWorkflowQueries(queryClient, review.branchId);

      addNotification({
        type: 'success',
        title: 'Review approved',
        message: 'The branch has been approved.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to approve',
        message: error.message,
      });
    },
    onSettled: () => {
      setIsSubmittingReview(false);
    },
  });
}

/**
 * Hook to request changes on a review
 */
export function useRequestChanges() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const updateReview = useWorkflowStore((s) => s.updateReview);
  const setIsSubmittingReview = useWorkflowStore((s) => s.setIsSubmittingReview);

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      setIsSubmittingReview(true);
      return reviewService.requestChanges(id, reason);
    },
    onSuccess: (review) => {
      updateReview(review);
      queryClient.setQueryData(reviewKeys.detail(review.id), review);
      invalidateWorkflowQueries(queryClient, review.branchId);

      addNotification({
        type: 'success',
        title: 'Changes requested',
        message: 'Changes have been requested on this branch.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to request changes',
        message: error.message,
      });
    },
    onSettled: () => {
      setIsSubmittingReview(false);
    },
  });
}

/**
 * Hook to cancel a review
 */
export function useCancelReview() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const removeReview = useWorkflowStore((s) => s.removeReview);

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reviewService.cancel(id, reason),
    onSuccess: (review) => {
      removeReview(review.id);
      queryClient.removeQueries({ queryKey: reviewKeys.detail(review.id) });
      invalidateWorkflowQueries(queryClient, review.branchId);

      addNotification({
        type: 'success',
        title: 'Review cancelled',
        message: 'The review has been cancelled.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to cancel review',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to add a comment to a review
 */
export function useAddReviewComment() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: ({
      reviewId,
      content,
      path,
      line,
    }: {
      reviewId: string;
      content: string;
      path?: string;
      line?: number;
    }) => reviewService.addComment(reviewId, content, path, line),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(variables.reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.comments(variables.reviewId),
      });

      addNotification({
        type: 'success',
        title: 'Comment added',
        message: 'Your comment has been posted.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to add comment',
        message: error.message,
      });
    },
  });
}

export default useReview;
