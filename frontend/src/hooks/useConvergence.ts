import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  convergenceService,
} from '../services/convergenceService';
import { useUIStore } from '../stores/index';
import { branchKeys } from './useBranch';

// Query keys
export const convergenceKeys = {
  all: ['convergence'] as const,
  details: () => [...convergenceKeys.all, 'detail'] as const,
  detail: (id: string) => [...convergenceKeys.details(), id] as const,
  status: (id: string) => [...convergenceKeys.all, id, 'status'] as const,
  branchOperations: (branchId: string) =>
    [...convergenceKeys.all, 'branch', branchId] as const,
  branchLatest: (branchId: string) =>
    [...convergenceKeys.all, 'branch', branchId, 'latest'] as const,
  validation: (branchId: string) =>
    [...convergenceKeys.all, 'validate', branchId] as const,
};

/**
 * Hook to fetch a convergence operation by ID
 */
export function useConvergence(id: string | undefined) {
  return useQuery({
    queryKey: convergenceKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Convergence ID required');
      return convergenceService.getById(id);
    },
    enabled: !!id,
  });
}

/**
 * Hook to poll convergence status
 */
export function useConvergenceStatus(id: string | undefined, poll = false) {
  return useQuery({
    queryKey: convergenceKeys.status(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Convergence ID required');
      return convergenceService.getStatus(id);
    },
    enabled: !!id,
    refetchInterval: poll ? 2000 : false,
  });
}

/**
 * Hook to validate a branch for convergence
 */
export function useValidateConvergence(branchId: string | undefined) {
  return useQuery({
    queryKey: convergenceKeys.validation(branchId || ''),
    queryFn: async () => {
      if (!branchId) throw new Error('Branch ID required');
      return convergenceService.validate(branchId);
    },
    enabled: !!branchId,
  });
}

/**
 * Hook to get convergence operations for a branch
 */
export function useBranchConvergence(branchId: string | undefined) {
  return useQuery({
    queryKey: convergenceKeys.branchOperations(branchId || ''),
    queryFn: async () => {
      if (!branchId) throw new Error('Branch ID required');
      return convergenceService.getByBranch(branchId);
    },
    enabled: !!branchId,
  });
}

/**
 * Hook to get the latest convergence for a branch
 */
export function useLatestConvergence(branchId: string | undefined) {
  return useQuery({
    queryKey: convergenceKeys.branchLatest(branchId || ''),
    queryFn: async () => {
      if (!branchId) throw new Error('Branch ID required');
      return convergenceService.getLatest(branchId);
    },
    enabled: !!branchId,
    retry: false, // Don't retry if no convergence exists
  });
}

/**
 * Hook to initiate a convergence operation
 */
export function useCreateConvergence() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: (branchId: string) => convergenceService.create(branchId),
    onSuccess: (operation) => {
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.branchOperations(operation.branchId),
      });

      addNotification({
        type: 'success',
        title: 'Convergence initiated',
        message: 'Convergence operation has been created.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to initiate convergence',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to execute a convergence operation
 */
export function useExecuteConvergence() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: (id: string) => convergenceService.execute(id),
    onSuccess: (operation) => {
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.detail(operation.id),
      });
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.branchOperations(operation.branchId),
      });
      queryClient.invalidateQueries({
        queryKey: branchKeys.detail(operation.branchId),
      });
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });

      if (operation.summary.isSucceeded) {
        addNotification({
          type: 'success',
          title: 'Branch published',
          message: 'Branch has been successfully merged to main.',
        });
      } else if (operation.conflictDetected) {
        addNotification({
          type: 'error',
          title: 'Publish failed',
          message: 'Conflicts were detected. Please resolve them and try again.',
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Publish failed',
          message: 'An error occurred during publishing.',
        });
      }
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to execute convergence',
        message: error.message,
      });
    },
  });
}

/**
 * Hook to publish a branch (create + execute in one step)
 */
export function usePublishBranch() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: (branchId: string) => convergenceService.publish(branchId),
    onSuccess: (operation) => {
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.branchOperations(operation.branchId),
      });
      queryClient.invalidateQueries({
        queryKey: branchKeys.detail(operation.branchId),
      });
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchKeys.myBranches() });

      if (operation.summary.isSucceeded) {
        addNotification({
          type: 'success',
          title: 'Branch published',
          message: 'Branch has been successfully merged to main.',
        });
      } else if (operation.conflictDetected) {
        addNotification({
          type: 'error',
          title: 'Publish failed',
          message: 'Conflicts were detected. Please resolve them and try again.',
        });
      }
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

/**
 * Hook to cancel a convergence operation
 */
export function useCancelConvergence() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  return useMutation({
    mutationFn: (id: string) => convergenceService.cancel(id),
    onSuccess: (operation) => {
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.detail(operation.id),
      });
      queryClient.invalidateQueries({
        queryKey: convergenceKeys.branchOperations(operation.branchId),
      });

      addNotification({
        type: 'success',
        title: 'Convergence cancelled',
        message: 'The convergence operation has been cancelled.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to cancel convergence',
        message: error.message,
      });
    },
  });
}

export default useConvergence;
