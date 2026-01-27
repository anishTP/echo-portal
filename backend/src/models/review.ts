import { z } from 'zod';
import type { Review, NewReview } from '../db/schema/reviews.js';
import {
  ReviewStatus,
  ReviewDecision,
  type ReviewStatusType,
  type ReviewDecisionType,
} from '@echo-portal/shared';
import type { ReviewComment } from '@echo-portal/shared';

/**
 * Validation schema for creating a new review
 */
export const createReviewSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  reviewerId: z.string().uuid('Invalid reviewer ID'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * Validation schema for submitting a review decision
 */
export const submitReviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  reason: z.string().max(10000).optional(),
});

export type SubmitReviewDecisionInput = z.infer<typeof submitReviewDecisionSchema>;

/**
 * Validation schema for adding a review comment
 */
export const addReviewCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(10000, 'Comment must be 10000 characters or less'),
  path: z.string().max(500).optional(),
  line: z.number().int().positive().optional(),
});

export type AddReviewCommentInput = z.infer<typeof addReviewCommentSchema>;

/**
 * Check if a review can have comments added
 */
export function canAddComment(review: Review): boolean {
  return review.status !== ReviewStatus.CANCELLED;
}

/**
 * Check if a review can be completed
 */
export function canComplete(review: Review): boolean {
  return (
    review.status === ReviewStatus.PENDING ||
    review.status === ReviewStatus.IN_PROGRESS
  );
}

/**
 * Check if a review can be cancelled
 */
export function canCancel(review: Review): boolean {
  return review.status !== ReviewStatus.COMPLETED;
}

/**
 * Check if a review is active (can receive actions)
 */
export function isActive(review: Review): boolean {
  return (
    review.status === ReviewStatus.PENDING ||
    review.status === ReviewStatus.IN_PROGRESS
  );
}

/**
 * Review model class for business logic
 */
export class ReviewModel {
  private data: Review;

  constructor(data: Review) {
    this.data = data;
  }

  get id(): string {
    return this.data.id;
  }

  get branchId(): string {
    return this.data.branchId;
  }

  get reviewerId(): string {
    return this.data.reviewerId;
  }

  get requestedById(): string {
    return this.data.requestedById;
  }

  get status(): ReviewStatusType {
    return this.data.status as ReviewStatusType;
  }

  get decision(): ReviewDecisionType | null {
    return (this.data.decision as ReviewDecisionType) ?? null;
  }

  get comments(): ReviewComment[] {
    return (this.data.comments as ReviewComment[]) || [];
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  get completedAt(): Date | null {
    return this.data.completedAt;
  }

  /**
   * Check if comments can be added
   */
  canAddComment(): boolean {
    return canAddComment(this.data);
  }

  /**
   * Check if review can be completed
   */
  canComplete(): boolean {
    return canComplete(this.data);
  }

  /**
   * Check if review can be cancelled
   */
  canCancel(): boolean {
    return canCancel(this.data);
  }

  /**
   * Check if review is active
   */
  isActive(): boolean {
    return isActive(this.data);
  }

  /**
   * Check if user is the assigned reviewer
   */
  isReviewer(userId: string): boolean {
    return this.reviewerId === userId;
  }

  /**
   * Check if user is the one who requested the review
   */
  isRequester(userId: string): boolean {
    return this.requestedById === userId;
  }

  /**
   * Check if the review is approved
   */
  isApproved(): boolean {
    return (
      this.status === ReviewStatus.COMPLETED &&
      this.decision === ReviewDecision.APPROVED
    );
  }

  /**
   * Check if changes were requested
   */
  hasChangesRequested(): boolean {
    return (
      this.status === ReviewStatus.COMPLETED &&
      this.decision === ReviewDecision.CHANGES_REQUESTED
    );
  }

  /**
   * Get the raw data
   */
  toJSON(): Review {
    return { ...this.data };
  }

  /**
   * Get a serializable representation for API responses
   */
  toResponse(): Record<string, unknown> {
    return {
      id: this.id,
      branchId: this.branchId,
      reviewerId: this.reviewerId,
      requestedById: this.requestedById,
      status: this.status,
      decision: this.decision,
      comments: this.comments,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      completedAt: this.completedAt?.toISOString() ?? null,
      permissions: {
        canAddComment: this.canAddComment(),
        canComplete: this.canComplete(),
        canCancel: this.canCancel(),
      },
    };
  }
}

/**
 * Create a ReviewModel from raw data
 */
export function createReviewModel(data: Review): ReviewModel {
  return new ReviewModel(data);
}
