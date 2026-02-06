import { api } from './api';
import type { Branch, BranchCreateInput, BranchUpdateInput, EditBranchCreateInput, EditBranchCreateResult } from '@echo-portal/shared';
import type { ReviewResponse } from './reviewService';

export interface BranchResponse extends Branch {
  permissions: {
    canEdit: boolean;
    canSubmitForReview: boolean;
    canApprove: boolean;
    canPublish: boolean;
    canArchive: boolean;
    validTransitions: string[];
  };
  /** Review records from the reviews table, embedded in the branch response */
  reviews?: ReviewResponse[];
}

export interface BranchListParams {
  page?: number;
  limit?: number;
  ownerId?: string;
  state?: string[];
  visibility?: string[];
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const branchService = {
  /**
   * Create a new branch
   */
  create: (input: BranchCreateInput): Promise<BranchResponse> => {
    return api.post<BranchResponse>('/branches', input);
  },

  /**
   * Get a branch by ID
   */
  getById: (id: string): Promise<BranchResponse> => {
    return api.get<BranchResponse>(`/branches/${id}`);
  },

  /**
   * List branches with optional filters
   */
  list: async (params: BranchListParams = {}): Promise<PaginatedResponse<BranchResponse>> => {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.ownerId) searchParams.set('ownerId', params.ownerId);
    if (params.state?.length) searchParams.set('state', params.state.join(','));
    if (params.visibility?.length) searchParams.set('visibility', params.visibility.join(','));
    if (params.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/branches?${queryString}` : '/branches';

    // Use api.getPaginated to include dev auth headers
    const result = await api.getPaginated<BranchResponse>(endpoint);

    // Transform to PaginatedResponse format expected by consumers
    return {
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    };
  },

  /**
   * Update a branch
   */
  update: (id: string, input: BranchUpdateInput): Promise<BranchResponse> => {
    return api.patch<BranchResponse>(`/branches/${id}`, input);
  },

  /**
   * Delete a branch
   */
  delete: (id: string): Promise<void> => {
    return api.delete(`/branches/${id}`);
  },

  /**
   * Get branches owned by current user
   */
  getMyBranches: (includeArchived = false): Promise<BranchResponse[]> => {
    const params = includeArchived ? '?includeArchived=true' : '';
    return api.get<BranchResponse[]>(`/branches/me${params}`);
  },

  /**
   * Get branches where current user is a reviewer
   */
  getReviewBranches: (): Promise<BranchResponse[]> => {
    return api.get<BranchResponse[]>('/branches/reviews');
  },

  /**
   * Add reviewers to a branch
   */
  addReviewers: (id: string, reviewerIds: string[]): Promise<BranchResponse> => {
    return api.post<BranchResponse>(`/branches/${id}/reviewers`, { reviewerIds });
  },

  /**
   * Remove a reviewer from a branch
   */
  removeReviewer: (id: string, reviewerId: string): Promise<BranchResponse> => {
    return api.delete<BranchResponse>(`/branches/${id}/reviewers/${reviewerId}`);
  },

  /**
   * Submit a branch for review with assigned reviewers
   * FR-017a: At least one reviewer must be assigned
   * Returns the updated branch along with transition result
   */
  submitForReview: (id: string, reviewerIds: string[], reason?: string): Promise<{
    transition: { success: boolean; toState?: string; error?: string };
    branch: BranchResponse;
  }> => {
    return api.post(`/branches/${id}/submit-for-review`, { reviewerIds, reason });
  },

  /**
   * Configure approval threshold for a branch (admin only)
   */
  setApprovalThreshold: (id: string, requiredApprovals: number): Promise<BranchResponse> => {
    return api.patch<BranchResponse>(`/branches/${id}/approval-threshold`, { requiredApprovals });
  },

  /**
   * Publish a branch (publisher/admin only)
   */
  publish: (id: string): Promise<any> => {
    return api.post(`/branches/${id}/publish`);
  },

  /**
   * Create a branch for editing published content.
   * Creates a new branch forked from main, copying the specified content.
   */
  createEditBranch: (input: EditBranchCreateInput): Promise<EditBranchCreateResult> => {
    return api.post<EditBranchCreateResult>('/branches/edit', input);
  },
};

export default branchService;
