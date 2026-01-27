import { db } from '../../db/index.js';
import { reviews, type Review, type NewReview } from '../../db/schema/reviews.js';
import { branches } from '../../db/schema/branches.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  ReviewModel,
  createReviewModel,
  createReviewSchema,
  submitReviewDecisionSchema,
  type CreateReviewInput,
  type SubmitReviewDecisionInput,
} from '../../models/review.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../../api/utils/errors.js';
import {
  ReviewStatus,
  ReviewDecision,
  BranchState,
  TransitionEvent,
} from '@echo-portal/shared';
import { transitionService } from '../workflow/transitions.js';

export interface ReviewListOptions {
  branchId?: string;
  reviewerId?: string;
  requestedById?: string;
  status?: string[];
  page?: number;
  limit?: number;
}

export interface ReviewListResult {
  reviews: ReviewModel[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class ReviewService {
  /**
   * Request a review for a branch
   */
  async create(input: CreateReviewInput, requestedById: string): Promise<ReviewModel> {
    // Validate input
    const parsed = createReviewSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid review input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { branchId, reviewerId } = parsed.data;

    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Check branch is in a reviewable state
    if (branch.state !== BranchState.DRAFT && branch.state !== BranchState.REVIEW) {
      throw new ValidationError(
        `Cannot request review for branch in '${branch.state}' state`
      );
    }

    // Check that requester is the branch owner
    if (branch.ownerId !== requestedById) {
      throw new ForbiddenError('Only the branch owner can request reviews');
    }

    // Cannot request review from yourself
    if (reviewerId === requestedById) {
      throw new ValidationError('Cannot request review from yourself');
    }

    // Check for existing active review from this reviewer
    const existingReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, branchId),
        eq(reviews.reviewerId, reviewerId),
        sql`${reviews.status} IN ('pending', 'in_progress')`
      ),
    });

    if (existingReview) {
      throw new ConflictError(
        'An active review from this reviewer already exists for this branch'
      );
    }

    // Create the review
    const newReview: NewReview = {
      branchId,
      reviewerId,
      requestedById,
      status: ReviewStatus.PENDING,
      comments: [],
    };

    const [inserted] = await db.insert(reviews).values(newReview).returning();

    // Add reviewer to branch if not already present
    const currentReviewers = branch.reviewers || [];
    if (!currentReviewers.includes(reviewerId)) {
      await db
        .update(branches)
        .set({
          reviewers: [...currentReviewers, reviewerId],
          updatedAt: new Date(),
        })
        .where(eq(branches.id, branchId));
    }

    return createReviewModel(inserted);
  }

  /**
   * Get a review by ID
   */
  async getById(id: string): Promise<ReviewModel | null> {
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
    });

    if (!review) {
      return null;
    }

    return createReviewModel(review);
  }

  /**
   * Get a review by ID, throwing if not found
   */
  async getByIdOrThrow(id: string): Promise<ReviewModel> {
    const review = await this.getById(id);
    if (!review) {
      throw new NotFoundError('Review', id);
    }
    return review;
  }

  /**
   * List reviews with filtering and pagination
   */
  async list(options: ReviewListOptions = {}): Promise<ReviewListResult> {
    const {
      branchId,
      reviewerId,
      requestedById,
      status,
      page = 1,
      limit = 20,
    } = options;

    // Build conditions
    const conditions = [];

    if (branchId) {
      conditions.push(eq(reviews.branchId, branchId));
    }

    if (reviewerId) {
      conditions.push(eq(reviews.reviewerId, reviewerId));
    }

    if (requestedById) {
      conditions.push(eq(reviews.requestedById, requestedById));
    }

    if (status && status.length > 0) {
      conditions.push(sql`${reviews.status} = ANY(${status})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(whereClause);

    // Get paginated results
    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(reviews)
      .where(whereClause)
      .orderBy(desc(reviews.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      reviews: results.map(createReviewModel),
      total: count,
      page,
      limit,
      hasMore: offset + results.length < count,
    };
  }

  /**
   * Start a review (mark as in progress)
   */
  async startReview(id: string, actorId: string): Promise<ReviewModel> {
    const review = await this.getByIdOrThrow(id);

    // Check actor is the reviewer
    if (!review.isReviewer(actorId)) {
      throw new ForbiddenError('Only the assigned reviewer can start this review');
    }

    // Check review is pending
    if (review.status !== ReviewStatus.PENDING) {
      throw new ValidationError(`Cannot start review in '${review.status}' status`);
    }

    const [updated] = await db
      .update(reviews)
      .set({
        status: ReviewStatus.IN_PROGRESS,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return createReviewModel(updated);
  }

  /**
   * Submit a review decision (approve or request changes)
   */
  async submitDecision(
    id: string,
    input: SubmitReviewDecisionInput,
    actorId: string,
    actorRoles: string[]
  ): Promise<ReviewModel> {
    // Validate input
    const parsed = submitReviewDecisionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid decision input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { decision, reason } = parsed.data;

    const review = await this.getByIdOrThrow(id);

    // Check actor is the reviewer
    if (!review.isReviewer(actorId)) {
      throw new ForbiddenError('Only the assigned reviewer can submit a decision');
    }

    // Check review can be completed
    if (!review.canComplete()) {
      throw new ValidationError(`Cannot complete review in '${review.status}' status`);
    }

    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, review.branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', review.branchId);
    }

    // Update the review
    const [updated] = await db
      .update(reviews)
      .set({
        status: ReviewStatus.COMPLETED,
        decision: decision as 'approved' | 'changes_requested',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    // Trigger branch state transition based on decision
    if (decision === ReviewDecision.APPROVED) {
      // Check if approval threshold is met
      const branch = await db.query.branches.findFirst({
        where: eq(branches.id, review.branchId),
      });

      if (!branch) {
        throw new NotFoundError('Branch', review.branchId);
      }

      // Count approved reviews (including this one)
      const stats = await this.getBranchReviewStats(review.branchId);
      const approvalCount = stats.approved;
      const requiredApprovals = branch.requiredApprovals || 1;

      // Only transition to approved if threshold is met
      if (approvalCount >= requiredApprovals) {
        await transitionService.executeTransition({
          branchId: review.branchId,
          event: TransitionEvent.APPROVE,
          actorId,
          actorRoles,
          reason: reason || `${approvalCount}/${requiredApprovals} approvals received`,
          metadata: { approvalCount, requiredApprovals },
        });
      }
      // Otherwise, branch stays in review state, just accumulating approvals
    } else if (decision === ReviewDecision.CHANGES_REQUESTED) {
      // Transition branch back to draft state (resets approval count)
      await transitionService.executeTransition({
        branchId: review.branchId,
        event: TransitionEvent.REQUEST_CHANGES,
        actorId,
        actorRoles,
        reason: reason || 'Changes requested',
      });
    }

    return createReviewModel(updated);
  }

  /**
   * Cancel a review
   */
  async cancel(id: string, actorId: string, reason?: string): Promise<ReviewModel> {
    const review = await this.getByIdOrThrow(id);

    // Check actor is the requester or the reviewer
    if (!review.isRequester(actorId) && !review.isReviewer(actorId)) {
      throw new ForbiddenError(
        'Only the requester or reviewer can cancel this review'
      );
    }

    // Check review can be cancelled
    if (!review.canCancel()) {
      throw new ValidationError(`Cannot cancel review in '${review.status}' status`);
    }

    const [updated] = await db
      .update(reviews)
      .set({
        status: ReviewStatus.CANCELLED,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return createReviewModel(updated);
  }

  /**
   * Get reviews for a branch
   */
  async getByBranch(branchId: string): Promise<ReviewModel[]> {
    const results = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branchId),
      orderBy: [desc(reviews.createdAt)],
    });

    return results.map(createReviewModel);
  }

  /**
   * Get reviews assigned to a reviewer
   */
  async getByReviewer(
    reviewerId: string,
    activeOnly: boolean = false
  ): Promise<ReviewModel[]> {
    const conditions = [eq(reviews.reviewerId, reviewerId)];

    if (activeOnly) {
      conditions.push(sql`${reviews.status} IN ('pending', 'in_progress')`);
    }

    const results = await db.query.reviews.findMany({
      where: and(...conditions),
      orderBy: [desc(reviews.updatedAt)],
    });

    return results.map(createReviewModel);
  }

  /**
   * Get pending reviews for a branch (checking if approval exists)
   */
  async hasApprovedReview(branchId: string): Promise<boolean> {
    const approvedReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, branchId),
        eq(reviews.status, ReviewStatus.COMPLETED),
        eq(reviews.decision, ReviewDecision.APPROVED)
      ),
    });

    return !!approvedReview;
  }

  /**
   * Get review statistics for a branch
   */
  async getBranchReviewStats(branchId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    approved: number;
    changesRequested: number;
    cancelled: number;
  }> {
    const allReviews = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branchId),
    });

    return {
      total: allReviews.length,
      pending: allReviews.filter((r) => r.status === ReviewStatus.PENDING).length,
      inProgress: allReviews.filter((r) => r.status === ReviewStatus.IN_PROGRESS)
        .length,
      completed: allReviews.filter((r) => r.status === ReviewStatus.COMPLETED)
        .length,
      approved: allReviews.filter(
        (r) =>
          r.status === ReviewStatus.COMPLETED &&
          r.decision === ReviewDecision.APPROVED
      ).length,
      changesRequested: allReviews.filter(
        (r) =>
          r.status === ReviewStatus.COMPLETED &&
          r.decision === ReviewDecision.CHANGES_REQUESTED
      ).length,
      cancelled: allReviews.filter((r) => r.status === ReviewStatus.CANCELLED)
        .length,
    };
  }
}

// Export singleton instance
export const reviewService = new ReviewService();
