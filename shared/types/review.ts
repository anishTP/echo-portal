import type { ReviewStatusType, ReviewDecisionType } from '../constants/states.js';

export interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  path?: string;
  line?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  branchId: string;
  reviewerId: string;
  requestedById: string;
  status: ReviewStatusType;
  decision?: ReviewDecisionType;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ReviewCreateInput {
  branchId: string;
  reviewerId: string;
}

export interface ReviewCommentInput {
  content: string;
  path?: string;
  line?: number;
}
