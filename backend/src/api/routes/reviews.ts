import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { reviewService } from '../../services/review/review-service.js';
import { reviewCommentService } from '../../services/review/comments.js';
import { snapshotService } from '../../services/review/snapshot-service.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, created, paginated, noContent } from '../utils/responses.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import {
  createReviewBodySchema,
  submitReviewDecisionBodySchema,
  addReviewCommentBodySchema,
  updateReviewCommentBodySchema,
  reviewIdParamSchema,
  reviewCommentIdParamSchema,
  listReviewsQuerySchema,
  validateReviewStatusFilter,
} from '../schemas/reviews.js';

const reviewRoutes = new Hono<AuthEnv>();

/**
 * POST /api/v1/reviews - Request a new review
 */
reviewRoutes.post(
  '/',
  requireAuth,
  zValidator('json', createReviewBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const review = await reviewService.create(body, user.id);
    return created(c, review.toResponse());
  }
);

/**
 * GET /api/v1/reviews - List reviews with filters
 */
reviewRoutes.get(
  '/',
  requireAuth,
  zValidator('query', listReviewsQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    // Validate status filter
    const statusFilter = validateReviewStatusFilter(query.status);

    const result = await reviewService.list({
      branchId: query.branchId,
      reviewerId: query.reviewerId,
      requestedById: query.requestedById,
      status: statusFilter,
      page: query.page,
      limit: query.limit,
    });

    return paginated(
      c,
      result.reviews.map((r) => r.toResponse()),
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      }
    );
  }
);

/**
 * GET /api/v1/reviews/me - Get reviews assigned to current user
 */
reviewRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const activeOnly = c.req.query('activeOnly') === 'true';

  const reviews = await reviewService.getByReviewer(user.id, activeOnly);
  return success(
    c,
    reviews.map((r) => r.toResponse())
  );
});

/**
 * GET /api/v1/reviews/:id - Get a review by ID
 * Query params: includeSnapshot=true to embed snapshot data
 */
reviewRoutes.get(
  '/:id',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const includeSnapshot = c.req.query('includeSnapshot') === 'true';

    const review = await reviewService.getById(id);
    if (!review) {
      throw new NotFoundError('Review', id);
    }

    const response: Record<string, unknown> = review.toResponse();

    if (includeSnapshot) {
      const snapshot = await snapshotService.getByReviewId(id);
      response.snapshot = snapshot || null;
    }

    return success(c, response);
  }
);

/**
 * POST /api/v1/reviews/:id/start - Start a review (mark as in progress)
 */
reviewRoutes.post(
  '/:id/start',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    const review = await reviewService.startReview(id, user.id);
    return success(c, review.toResponse());
  }
);

/**
 * POST /api/v1/reviews/:id/approve - Approve a review
 */
reviewRoutes.post(
  '/:id/approve',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  zValidator('json', submitReviewDecisionBodySchema.pick({ reason: true }).partial()),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const review = await reviewService.submitDecision(
      id,
      { decision: 'approved', reason: body.reason },
      user.id,
      user.roles || []
    );
    return success(c, review.toResponse());
  }
);

/**
 * POST /api/v1/reviews/:id/request-changes - Request changes on a review
 */
reviewRoutes.post(
  '/:id/request-changes',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  zValidator('json', submitReviewDecisionBodySchema.pick({ reason: true })),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const review = await reviewService.submitDecision(
      id,
      { decision: 'changes_requested', reason: body.reason },
      user.id,
      user.roles || []
    );
    return success(c, review.toResponse());
  }
);

/**
 * POST /api/v1/reviews/:id/cancel - Cancel a review
 */
reviewRoutes.post(
  '/:id/cancel',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const reason = c.req.query('reason');

    const review = await reviewService.cancel(id, user.id, reason);
    return success(c, review.toResponse());
  }
);

/**
 * GET /api/v1/reviews/:id/comments - Get all comments for a review
 */
reviewRoutes.get(
  '/:id/comments',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const comments = await reviewCommentService.getComments(id);
    return success(c, comments);
  }
);

/**
 * POST /api/v1/reviews/:id/comments - Add a comment to a review
 */
reviewRoutes.post(
  '/:id/comments',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  zValidator('json', addReviewCommentBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const comment = await reviewCommentService.addComment(id, body, user.id);
    return created(c, comment);
  }
);

/**
 * PATCH /api/v1/reviews/:id/comments/:commentId - Update a comment
 */
reviewRoutes.patch(
  '/:id/comments/:commentId',
  requireAuth,
  zValidator('param', reviewCommentIdParamSchema),
  zValidator('json', updateReviewCommentBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, commentId } = c.req.valid('param');
    const { content } = c.req.valid('json');

    const comment = await reviewCommentService.updateComment(
      id,
      commentId,
      content,
      user.id
    );
    return success(c, comment);
  }
);

/**
 * DELETE /api/v1/reviews/:id/comments/:commentId - Delete a comment
 */
reviewRoutes.delete(
  '/:id/comments/:commentId',
  requireAuth,
  zValidator('param', reviewCommentIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, commentId } = c.req.valid('param');

    await reviewCommentService.deleteComment(id, commentId, user.id);
    return noContent(c);
  }
);

/**
 * GET /api/v1/reviews/branch/:branchId - Get all reviews for a branch
 */
reviewRoutes.get(
  '/branch/:branchId',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const reviews = await reviewService.getByBranch(branchId);
    return success(
      c,
      reviews.map((r) => r.toResponse())
    );
  }
);

/**
 * GET /api/v1/reviews/branch/:branchId/stats - Get review statistics for a branch
 */
reviewRoutes.get(
  '/branch/:branchId/stats',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const stats = await reviewService.getBranchReviewStats(branchId);
    return success(c, stats);
  }
);

/**
 * GET /api/v1/reviews/:id/snapshot - Get comparison snapshot for a review
 */
reviewRoutes.get(
  '/:id/snapshot',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const snapshot = await snapshotService.getByReviewId(id);
    if (!snapshot) {
      throw new NotFoundError('Snapshot', id);
    }

    return success(c, snapshot);
  }
);

/**
 * POST /api/v1/reviews/:id/comments/:commentId/reply - Reply to a comment
 */
reviewRoutes.post(
  '/:id/comments/:commentId/reply',
  requireAuth,
  zValidator('param', reviewCommentIdParamSchema),
  zValidator('json', z.object({ content: z.string().min(1).max(10000) })),
  async (c) => {
    const user = c.get('user')!;
    const { id, commentId } = c.req.valid('param');
    const { content } = c.req.valid('json');

    const reply = await reviewCommentService.addReply(id, commentId, content, user.id);
    return created(c, reply);
  }
);

/**
 * POST /api/v1/reviews/:id/comments/:commentId/resolve - Resolve a comment
 */
reviewRoutes.post(
  '/:id/comments/:commentId/resolve',
  requireAuth,
  zValidator('param', reviewCommentIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, commentId } = c.req.valid('param');

    const comment = await reviewCommentService.resolveComment(id, commentId, user.id);
    return success(c, comment);
  }
);

/**
 * POST /api/v1/reviews/:id/comments/:commentId/unresolve - Unresolve a comment
 */
reviewRoutes.post(
  '/:id/comments/:commentId/unresolve',
  requireAuth,
  zValidator('param', reviewCommentIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, commentId } = c.req.valid('param');

    const comment = await reviewCommentService.unresolveComment(id, commentId, user.id);
    return success(c, comment);
  }
);

/**
 * POST /api/v1/reviews/:id/refresh-comments - Refresh outdated comment status
 */
reviewRoutes.post(
  '/:id/refresh-comments',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const result = await reviewCommentService.refreshOutdatedStatus(id);
    return success(c, result);
  }
);

/**
 * GET /api/v1/branches/:branchId/review-status - Get current review status for a branch
 */
reviewRoutes.get(
  '/branch/:branchId/review-status',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const [stats, subState] = await Promise.all([
      reviewService.getBranchReviewStats(branchId),
      reviewService.deriveReviewSubState(branchId),
    ]);

    // Get branch for required approvals
    const { db } = await import('../../db/index.js');
    const { branches } = await import('../../db/schema/branches.js');
    const { eq } = await import('drizzle-orm');

    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    const requiredApprovals = branch.requiredApprovals || 1;
    const approvalProgress = {
      approved: stats.approved,
      required: requiredApprovals,
      remaining: Math.max(0, requiredApprovals - stats.approved),
    };

    return success(c, {
      branchId,
      branchState: branch.state,
      reviewSubState: branch.state === 'review' ? subState : null,
      approvalProgress,
      hasBlockingChangesRequested: stats.changesRequested > 0,
    });
  }
);

/**
 * GET /api/v1/branches/:branchId/review-cycles - Get review cycle history
 */
reviewRoutes.get(
  '/branch/:branchId/review-cycles',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const cycles = await reviewService.getReviewCycles(branchId);
    const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1].cycleNumber : 1;

    return success(c, {
      branchId,
      cycles,
      currentCycle,
    });
  }
);

/**
 * POST /api/v1/reviews/:id/reviewers - Add a reviewer to a branch's active review
 */
reviewRoutes.post(
  '/:id/reviewers',
  requireAuth,
  zValidator('param', reviewIdParamSchema),
  zValidator('json', z.object({ reviewerId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { reviewerId } = c.req.valid('json');

    const result = await reviewService.addReviewer(id, reviewerId, user.id);
    return created(c, result);
  }
);

/**
 * DELETE /api/v1/reviews/:id/reviewers/:userId - Remove a reviewer
 */
reviewRoutes.delete(
  '/:id/reviewers/:userId',
  requireAuth,
  zValidator(
    'param',
    z.object({ id: z.string().uuid(), userId: z.string().uuid() })
  ),
  async (c) => {
    const user = c.get('user')!;
    const { id, userId } = c.req.valid('param');

    await reviewService.removeReviewer(id, userId, user.id);
    return noContent(c);
  }
);

export { reviewRoutes };
