import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService } from '../services/branchService';
import type { EditBranchCreateInput, EditBranchCreateResult } from '@echo-portal/shared';

export interface UseEditBranchOptions {
  /** Callback when branch is created successfully */
  onSuccess?: (branchId: string, contentId: string) => void;
  /** Callback when branch creation fails */
  onError?: (error: Error) => void;
  /** Whether to navigate to the editor after creation (default: false for inline editing) */
  navigateToEditor?: boolean;
}

export interface UseEditBranchReturn {
  /** Create an edit branch from published content. Returns branch/content IDs on success. */
  createEditBranch: (sourceContentId: string, name: string, slug: string) => Promise<EditBranchCreateResult | null>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
  /** Last successful result */
  result: EditBranchCreateResult | null;
}

/**
 * Hook for creating an edit branch from published content.
 * By default does NOT navigate after creation, allowing the caller to handle
 * the transition (e.g., for inline editing on Library page).
 *
 * Set `navigateToEditor: true` to automatically redirect to the full editor.
 */
export function useEditBranch(options: UseEditBranchOptions = {}): UseEditBranchReturn {
  const { navigateToEditor = false } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<EditBranchCreateResult | null>(null);

  const mutation = useMutation({
    mutationFn: (input: EditBranchCreateInput) => branchService.createEditBranch(input),
    onSuccess: (createResult) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['branches'] });

      // Store result for caller access
      setResult(createResult);

      // Call success callback
      options.onSuccess?.(createResult.branch.id, createResult.content.id);

      // Only navigate if explicitly requested
      if (navigateToEditor) {
        navigate(`/branches/${createResult.branch.id}/content/${createResult.content.id}/edit`);
      }
    },
    onError: (err: Error) => {
      setError(err);
      options.onError?.(err);
    },
  });

  const createEditBranch = useCallback(
    async (sourceContentId: string, name: string, slug: string): Promise<EditBranchCreateResult | null> => {
      setError(null);
      setResult(null);
      try {
        const createResult = await mutation.mutateAsync({
          sourceContentId,
          name,
          slug,
        });
        return createResult;
      } catch {
        // Error is already handled in onError callback
        return null;
      }
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    mutation.reset();
  }, [mutation]);

  return {
    createEditBranch,
    isLoading: mutation.isPending,
    error,
    reset,
    result,
  };
}

export default useEditBranch;
