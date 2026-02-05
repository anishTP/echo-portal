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
  type ReviewCycleSummary,
  type CycleOutcome,
  type ReviewSubState,
} from '@echo-portal/shared';
import { transitionService } from '../workflow/transitions.js';
import { snapshotService } from './snapshot-service.js';
import {
  notifyReviewApproved,
  notifyChangesRequested,
  notifyReviewerAdded,
  notifyReviewerRemoved,
} from './review-notifications.js';

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

    // Determine the review cycle (increment if previous cycle had changes_requested)
    const existingReviews = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branchId),
    });
    const maxCycle = existingReviews.reduce((max, r) => Math.max(max, r.reviewCycle || 1), 0);
    const reviewCycle = branch.state === BranchState.DRAFT && maxCycle > 0 ? maxCycle + 1 : Math.max(maxCycle, 1);

    // Create the review
    const newReview: NewReview = {
      branchId,
      reviewerId,
      requestedById,
      status: ReviewStatus.PENDING,
      reviewCycle,
      comments: [],
    };

    const [inserted] = await db.insert(reviews).values(newReview).returning();

    // Create snapshot for this review (FR-003)
    try {
      await snapshotService.createSnapshot(inserted.id, branchId);
    } catch (error) {
      console.error('[Review] Failed to create snapshot:', error);
      // Continue - snapshot creation failure shouldn't block review creation
    }

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
      throw new ValidationError(`Review already completed in '${review.status}' status`);
    }

    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, review.branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', review.branchId);
    }

    // Check branch is in review state
    if (branch.state !== BranchState.REVIEW) {
      throw new ValidationError(
        `Branch is not in review state (current state: '${branch.state}')`
      );
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

    // Get branch name for notifications
    const branchName = branch.name || branch.id;

    // Trigger branch state transition based on decision
    if (decision === ReviewDecision.APPROVED) {
      // FR-016: Check that automated approval is not the sole approval
      const isAutomatedActor = actorRoles.includes('system') || actorRoles.includes('automation');
      if (isAutomatedActor) {
        const stats = await this.getBranchReviewStats(review.branchId);
        // Count existing human approvals (excluding this one since we just set it)
        const allBranchReviews = await db.query.reviews.findMany({
          where: eq(reviews.branchId, review.branchId),
        });
        const humanApprovals = allBranchReviews.filter(
          (r) =>
            r.id !== id &&
            r.status === ReviewStatus.COMPLETED &&
            r.decision === ReviewDecision.APPROVED
        );
        if (humanApprovals.length === 0) {
          // Automated approval recorded but won't trigger transition alone
          console.log(
            '[Review] Automated approval recorded but not sole approval - waiting for human approval'
          );
          return createReviewModel(updated);
        }
      }

      // Send approval notification (FR-013)
      notifyReviewApproved(
        {
          id: review.id,
          branchId: review.branchId,
          reviewerId: actorId,
          requestedById: review.requestedById,
        },
        branchName
      ).catch((err) => console.error('[Review] Failed to send approval notification:', err));
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
        const transitionResult = await transitionService.executeTransition({
          branchId: review.branchId,
          event: TransitionEvent.APPROVE,
          actorId,
          actorRoles,
          reason: reason || `${approvalCount}/${requiredApprovals} approvals received`,
          metadata: { approvalCount, requiredApprovals },
        });

        if (!transitionResult.success) {
          console.error('[Review] Failed to transition branch to approved:', transitionResult.error);
          throw new ValidationError(
            `Failed to transition branch: ${transitionResult.error || 'Unknown error'}`
          );
        }
      }
      // Otherwise, branch stays in review state, just accumulating approvals
    } else if (decision === ReviewDecision.CHANGES_REQUESTED) {
      // Send changes requested notification (FR-010)
      notifyChangesRequested(
        {
          id: review.id,
          branchId: review.branchId,
          reviewerId: actorId,
          requestedById: review.requestedById,
        },
        branchName,
        reason
      ).catch((err) => console.error('[Review] Failed to send changes requested notification:', err));

      // Transition branch back to draft state (resets approval count)
      const transitionResult = await transitionService.executeTransition({
        branchId: review.branchId,
        event: TransitionEvent.REQUEST_CHANGES,
        actorId,
        actorRoles,
        reason: reason || 'Changes requested',
      });

      if (!transitionResult.success) {
        console.error('[Review] Failed to transition branch to draft after changes requested:', transitionResult.error);
        throw new ValidationError(
          `Failed to transition branch: ${transitionResult.error || 'Unknown error'}`
        );
      }
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

  /**
   * Get review cycles for a branch
   * Returns summary of all review cycles for tracking iterative review progress
   */
  async getReviewCycles(branchId: string): Promise<ReviewCycleSummary[]> {
    const allReviews = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branchId),
      orderBy: [desc(reviews.createdAt)],
    });

    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Group reviews by cycle
    const cycleMap = new Map<number, Review[]>();
    for (const review of allReviews) {
      const cycle = review.reviewCycle || 1;
      if (!cycleMap.has(cycle)) {
        cycleMap.set(cycle, []);
      }
      cycleMap.get(cycle)!.push(review);
    }

    // Build cycle summaries
    return Array.from(cycleMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([cycleNumber, cycleReviews]) => ({
        cycleNumber,
        submittedAt: cycleReviews[0]?.createdAt?.toISOString() || new Date().toISOString(),
        outcome: this.deriveCycleOutcome(cycleReviews, branch.requiredApprovals || 1),
        approvalCount: cycleReviews.filter(
          (r) => r.status === ReviewStatus.COMPLETED && r.decision === ReviewDecision.APPROVED
        ).length,
        requiredApprovals: branch.requiredApprovals || 1,
        reviewerCount: cycleReviews.length,
      }));
  }

  /**
   * Derive the outcome of a review cycle
   */
  deriveCycleOutcome(cycleReviews: Review[], requiredApprovals: number): CycleOutcome {
    const active = cycleReviews.filter((r) => r.status !== ReviewStatus.CANCELLED);

    // Check for changes requested (any reviewer)
    if (active.some((r) => r.decision === ReviewDecision.CHANGES_REQUESTED)) {
      return 'changes_requested';
    }

    // Check for approval threshold met
    const approvedCount = active.filter(
      (r) => r.status === ReviewStatus.COMPLETED && r.decision === ReviewDecision.APPROVED
    ).length;

    if (approvedCount >= requiredApprovals) {
      return 'approved';
    }

    // Check if all reviews were cancelled (withdrawn)
    if (cycleReviews.length > 0 && cycleReviews.every((r) => r.status === ReviewStatus.CANCELLED)) {
      return 'withdrawn';
    }

    return 'pending';
  }

  /**
   * Derive the review sub-state for a branch in review state
   */
  async deriveReviewSubState(branchId: string): Promise<ReviewSubState> {
    const allReviews = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branchId),
    });

    // Get the current cycle's reviews
    const maxCycle = allReviews.reduce((max, r) => Math.max(max, r.reviewCycle || 1), 0);
    const currentCycleReviews = allReviews.filter((r) => (r.reviewCycle || 1) === maxCycle);
    const active = currentCycleReviews.filter((r) => r.status !== ReviewStatus.CANCELLED);

    // Check for changes requested
    if (active.some((r) => r.decision === ReviewDecision.CHANGES_REQUESTED)) {
      return 'changes_requested';
    }

    // Check for all approved
    if (
      active.length > 0 &&
      active.every((r) => r.status === ReviewStatus.COMPLETED && r.decision === ReviewDecision.APPROVED)
    ) {
      return 'approved';
    }

    // Check if any discussion (comments added)
    if (
      active.some(
        (r) =>
          r.status === ReviewStatus.IN_PROGRESS ||
          (Array.isArray(r.comments) && r.comments.length > 0)
      )
    ) {
      return 'in_discussion';
    }

    return 'pending_review';
  }

  /**
   * Add a reviewer to a branch (creates a new pending review)
   * T065: POST /reviews/:reviewId/reviewers
   */
  async addReviewer(
    reviewId: string,
    reviewerId: string,
    actorId: string
  ): Promise<ReviewModel> {
    // Get the source review to find the branch
    const sourceReview = await this.getByIdOrThrow(reviewId);

    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, sourceReview.branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', sourceReview.branchId);
    }

    // Only branch owner or admin can add reviewers
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can add reviewers');
    }

    // Cannot add self as reviewer
    if (reviewerId === branch.ownerId) {
      throw new ValidationError('Cannot add the branch owner as a reviewer');
    }

    // Branch must be in review state
    if (branch.state !== BranchState.REVIEW) {
      throw new ValidationError(
        `Cannot add reviewers when branch is in '${branch.state}' state`
      );
    }

    // Check for existing active review from this reviewer
    const existing = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, branch.id),
        eq(reviews.reviewerId, reviewerId),
        sql`${reviews.status} IN ('pending', 'in_progress')`
      ),
    });

    if (existing) {
      throw new ConflictError(
        'This reviewer already has an active review for this branch'
      );
    }

    // Determine cycle
    const allReviews = await db.query.reviews.findMany({
      where: eq(reviews.branchId, branch.id),
    });
    const maxCycle = allReviews.reduce((max, r) => Math.max(max, r.reviewCycle || 1), 0);

    // Create new review for the added reviewer
    const [inserted] = await db
      .insert(reviews)
      .values({
        branchId: branch.id,
        reviewerId,
        requestedById: actorId,
        status: ReviewStatus.PENDING,
        reviewCycle: Math.max(maxCycle, 1),
        comments: [],
      })
      .returning();

    // Add to branch reviewers list
    const currentReviewers = branch.reviewers || [];
    if (!currentReviewers.includes(reviewerId)) {
      await db
        .update(branches)
        .set({
          reviewers: [...currentReviewers, reviewerId],
          updatedAt: new Date(),
        })
        .where(eq(branches.id, branch.id));
    }

    // T069: Send notification
    const branchName = branch.name || branch.id;
    notifyReviewerAdded(branch.id, reviewerId, branchName, actorId).catch(
      (err) => console.error('[Review] Failed to send reviewer added notification:', err)
    );

    return createReviewModel(inserted);
  }

  /**
   * Remove a reviewer from a branch
   * T066: DELETE /reviews/:reviewId/reviewers/:userId
   * T067: Preserves existing feedback (review stays completed, just cancels pending)
   */
  async removeReviewer(
    reviewId: string,
    reviewerId: string,
    actorId: string
  ): Promise<void> {
    const sourceReview = await this.getByIdOrThrow(reviewId);

    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, sourceReview.branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', sourceReview.branchId);
    }

    // Only branch owner or admin can remove reviewers
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can remove reviewers');
    }

    // Find active (pending/in_progress) reviews from this reviewer and cancel them
    // Completed reviews are preserved (T067: feedback remains visible)
    const activeReviews = await db.query.reviews.findMany({
      where: and(
        eq(reviews.branchId, branch.id),
        eq(reviews.reviewerId, reviewerId),
        sql`${reviews.status} IN ('pending', 'in_progress')`
      ),
    });

    for (const review of activeReviews) {
      await db
        .update(reviews)
        .set({
          status: ReviewStatus.CANCELLED,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, review.id));
    }

    // Remove from branch reviewers list
    const currentReviewers = branch.reviewers || [];
    const updatedReviewers = currentReviewers.filter((id: string) => id !== reviewerId);
    await db
      .update(branches)
      .set({
        reviewers: updatedReviewers,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branch.id));

    // T069: Send notification
    const branchName = branch.name || branch.id;
    notifyReviewerRemoved(branch.id, reviewerId, branchName, actorId).catch(
      (err) => console.error('[Review] Failed to send reviewer removed notification:', err)
    );
  }
}

// Export singleton instance
export const reviewService = new ReviewService();
