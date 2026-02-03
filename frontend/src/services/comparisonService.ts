import { api } from './api';
import type { BranchComparison, FileDiff } from '@echo-portal/shared';

/**
 * API client for branch comparison operations
 * Used by the in-context review interface
 */
export const comparisonService = {
  /**
   * Get branch comparison for review
   * Returns the diff between the branch head and its base state
   */
  getBranchComparison: (
    branchId: string,
    snapshotId?: string
  ): Promise<BranchComparison> => {
    const params = snapshotId ? `?snapshotId=${snapshotId}` : '';
    return api.get<BranchComparison>(`/branches/${branchId}/comparison${params}`);
  },

  /**
   * Get diff for a specific file
   * Returns detailed diff for a single file
   */
  getFileDiff: (
    branchId: string,
    filePath: string,
    snapshotId?: string
  ): Promise<FileDiff> => {
    const encodedPath = encodeURIComponent(filePath);
    const params = snapshotId ? `?snapshotId=${snapshotId}` : '';
    return api.get<FileDiff>(
      `/branches/${branchId}/comparison/files/${encodedPath}${params}`
    );
  },
};

export default comparisonService;
