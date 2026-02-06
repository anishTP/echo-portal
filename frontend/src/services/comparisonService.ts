import { api } from './api';
import type { BranchComparison, FileDiff, ContentComparisonStats } from '@echo-portal/shared';

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

  /**
   * Get DB-backed content comparison for a branch
   * Compares content bodies stored in PostgreSQL
   */
  getContentComparison: (branchId: string): Promise<BranchComparison> => {
    return api.get<BranchComparison>(`/branches/${branchId}/content-comparison`);
  },

  /**
   * Get lightweight content comparison stats for sidebar display
   */
  getContentComparisonStats: (branchId: string): Promise<ContentComparisonStats> => {
    return api.get<ContentComparisonStats>(`/branches/${branchId}/content-comparison/stats`);
  },
};

export default comparisonService;
