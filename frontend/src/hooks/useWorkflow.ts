import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { branchKeys } from './useBranch';
import { useUIStore } from '../stores/index';
import type { TransitionEventType } from '@echo-portal/shared';

export interface TransitionResult {
  success: boolean;
  fromState: string;
  toState?: string;
  transitionId?: string;
  error?: string;
}

export interface TransitionHistory {
  id: string;
  fromState: string;
  toState: string;
  actorId: string;
  actorType: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CanTransitionResult {
  allowed: boolean;
  reason?: string;
}

// Workflow service
export const workflowService = {
  /**
   * Execute a state transition on a branch
   */
  transition: (
    branchId: string,
    event: TransitionEventType,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<TransitionResult> => {
    return api.post<TransitionResult>(`/branches/${branchId}/transitions`, {
      event,
      reason,
      metadata,
    });
  },

  /**
   * Get transition history for a branch
   */
  getHistory: (branchId: string): Promise<TransitionHistory[]> => {
    return api.get<TransitionHistory[]>(`/branches/${branchId}/transitions`);
  },

  /**
   * Check if a transition is allowed (dry run)
   */
  canTransition: (
    branchId: string,
    event: TransitionEventType
  ): Promise<CanTransitionResult> => {
    return api.get<CanTransitionResult>(
      `/branches/${branchId}/can-transition?event=${event}`
    );
  },
};

/**
 * Hook to execute a branch state transition
 */
export function useTransition() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: ({
      branchId,
      event,
      reason,
      metadata,
    }: {
      branchId: string;
      event: TransitionEventType;
      reason?: string;
      metadata?: Record<string, unknown>;
    }) => workflowService.transition(branchId, event, reason, metadata),

    onSuccess: (result, { branchId, event }) => {
      if (result.success) {
        // Invalidate branch queries
        queryClient.invalidateQueries({ queryKey: branchKeys.detail(branchId) });
        queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
        queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });
        queryClient.invalidateQueries({ queryKey: branchKeys.reviewBranches() });

        const eventLabels: Record<TransitionEventType, string> = {
          SUBMIT_FOR_REVIEW: 'submitted for review',
          REQUEST_CHANGES: 'returned for changes',
          APPROVE: 'approved',
          PUBLISH: 'published',
          ARCHIVE: 'archived',
        };

        addNotification({
          type: 'success',
          title: 'Branch updated',
          message: `Branch has been ${eventLabels[event]}.`,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Transition failed',
          message: result.error || 'Unknown error occurred',
        });
      }
    },

    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Transition failed',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to submit a branch for review
 */
export function useSubmitForReview() {
  const transition = useTransition();

  return {
    ...transition,
    mutateAsync: (branchId: string, reason?: string) =>
      transition.mutateAsync({
        branchId,
        event: 'SUBMIT_FOR_REVIEW',
        reason,
      }),
  };
}

/**
 * Hook to archive a branch
 */
export function useArchiveBranch() {
  const transition = useTransition();

  return {
    ...transition,
    mutateAsync: (branchId: string, reason?: string) =>
      transition.mutateAsync({
        branchId,
        event: 'ARCHIVE',
        reason,
      }),
  };
}

export default useTransition;
