import { api } from './api';
import type {
  ReviewStatusType,
  ReviewDecisionType,
  ReviewSnapshot,
  ReviewCycleSummary,
  ReviewStatusResponse,
} from '@echo-portal/shared';

export interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  path?: string;
  line?: number;
  hunkId?: string;
  side?: 'old' | 'new';
  parentId?: string;
  isOutdated: boolean;
  outdatedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewResponse {
  id: string;
  branchId: string;
  reviewerId: string;
  requestedById: string;
  status: ReviewStatusType;
  decision: ReviewDecisionType | null;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  permissions: {
    canAddComment: boolean;
    canComplete: boolean;
    canCancel: boolean;
  };
}

export interface ReviewListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  reviewerId?: string;
  requestedById?: string;
  status?: string[];
}

export interface ReviewStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  approved: number;
  changesRequested: number;
  cancelled: number;
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

export const reviewService = {
  /**
   * Request a new review
   */
  create: (branchId: string, reviewerId: string): Promise<ReviewResponse> => {
    return api.post<ReviewResponse>('/reviews', { branchId, reviewerId });
  },

  /**
   * Get a review by ID
   */
  getById: (id: string): Promise<ReviewResponse> => {
    return api.get<ReviewResponse>(`/reviews/${id}`);
  },

  /**
   * List reviews with optional filters
   */
  list: async (
    params: ReviewListParams = {}
  ): Promise<PaginatedResponse<ReviewResponse>> => {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.branchId) searchParams.set('branchId', params.branchId);
    if (params.reviewerId) searchParams.set('reviewerId', params.reviewerId);
    if (params.requestedById)
      searchParams.set('requestedById', params.requestedById);
    if (params.status?.length) searchParams.set('status', params.status.join(','));

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/reviews?${queryString}` : '/reviews';

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || '/api/v1'}${endpoint}`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch reviews');
    }

    return response.json();
  },

  /**
   * Get reviews assigned to current user
   */
  getMyReviews: (activeOnly = false): Promise<ReviewResponse[]> => {
    const params = activeOnly ? '?activeOnly=true' : '';
    return api.get<ReviewResponse[]>(`/reviews/me${params}`);
  },

  /**
   * Get reviews for a specific branch
   */
  getByBranch: (branchId: string): Promise<ReviewResponse[]> => {
    return api.get<ReviewResponse[]>(`/reviews/branch/${branchId}`);
  },

  /**
   * Get review statistics for a branch
   */
  getBranchStats: (branchId: string): Promise<ReviewStats> => {
    return api.get<ReviewStats>(`/reviews/branch/${branchId}/stats`);
  },

  /**
   * Start a review (mark as in progress)
   */
  start: (id: string): Promise<ReviewResponse> => {
    return api.post<ReviewResponse>(`/reviews/${id}/start`);
  },

  /**
   * Approve a review
   */
  approve: (id: string, reason?: string): Promise<ReviewResponse> => {
    return api.post<ReviewResponse>(`/reviews/${id}/approve`, { reason });
  },

  /**
   * Request changes on a review
   */
  requestChanges: (id: string, reason: string): Promise<ReviewResponse> => {
    return api.post<ReviewResponse>(`/reviews/${id}/request-changes`, { reason });
  },

  /**
   * Cancel a review
   */
  cancel: (id: string, reason?: string): Promise<ReviewResponse> => {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return api.post<ReviewResponse>(`/reviews/${id}/cancel${params}`);
  },

  /**
   * Get comments for a review
   */
  getComments: (id: string): Promise<ReviewComment[]> => {
    return api.get<ReviewComment[]>(`/reviews/${id}/comments`);
  },

  /**
   * Add a comment to a review
   */
  addComment: (
    id: string,
    content: string,
    path?: string,
    line?: number
  ): Promise<ReviewComment> => {
    return api.post<ReviewComment>(`/reviews/${id}/comments`, {
      content,
      path,
      line,
    });
  },

  /**
   * Update a comment
   */
  updateComment: (
    reviewId: string,
    commentId: string,
    content: string
  ): Promise<ReviewComment> => {
    return api.patch<ReviewComment>(`/reviews/${reviewId}/comments/${commentId}`, {
      content,
    });
  },

  /**
   * Delete a comment
   */
  deleteComment: (reviewId: string, commentId: string): Promise<void> => {
    return api.delete(`/reviews/${reviewId}/comments/${commentId}`);
  },

  /**
   * Reply to a comment (threading)
   */
  replyToComment: (
    reviewId: string,
    commentId: string,
    content: string
  ): Promise<ReviewComment> => {
    return api.post<ReviewComment>(
      `/reviews/${reviewId}/comments/${commentId}/reply`,
      { content }
    );
  },

  /**
   * Refresh outdated comment status
   */
  refreshComments: (
    reviewId: string
  ): Promise<{ updatedCount: number; comments: ReviewComment[] }> => {
    return api.post<{ updatedCount: number; comments: ReviewComment[] }>(
      `/reviews/${reviewId}/refresh-comments`
    );
  },

  /**
   * Get review snapshot
   */
  getSnapshot: (reviewId: string): Promise<ReviewSnapshot> => {
    return api.get<ReviewSnapshot>(`/reviews/${reviewId}/snapshot`);
  },

  /**
   * Get review cycles for a branch
   */
  getReviewCycles: (branchId: string): Promise<{ branchId: string; cycles: ReviewCycleSummary[]; currentCycle: number }> => {
    return api.get<{ branchId: string; cycles: ReviewCycleSummary[]; currentCycle: number }>(
      `/branches/${branchId}/review-cycles`
    );
  },

  /**
   * Get review status for a branch
   */
  getReviewStatus: (branchId: string): Promise<ReviewStatusResponse> => {
    return api.get<ReviewStatusResponse>(`/branches/${branchId}/review-status`);
  },
};

export default reviewService;
