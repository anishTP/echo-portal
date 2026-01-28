import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { branchService } from '../../services/branch/branch-service.js';
import { visibilityService, type AccessContext } from '../../services/branch/visibility.js';
import { teamService } from '../../services/branch/team.js';
import { transitionService } from '../../services/workflow/transitions.js';
import { reviewService } from '../../services/review/review-service.js';
import { diffService } from '../../services/git/diff.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, created, paginated, noContent } from '../utils/responses.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import {
  createBranchBodySchema,
  updateBranchBodySchema,
  branchIdParamSchema,
  listBranchesQuerySchema,
  addReviewersBodySchema,
  removeReviewerParamsSchema,
  addCollaboratorsBodySchema,
  removeCollaboratorParamsSchema,
  submitForReviewBodySchema,
  updateApprovalThresholdBodySchema,
  validateStateFilter,
  validateVisibilityFilter,
} from '../schemas/branches.js';
import { transitionBranchBodySchema } from '../schemas/reviews.js';
import { TransitionEvent, type TransitionEventType } from '@echo-portal/shared';

const branchRoutes = new Hono<AuthEnv>();

/**
 * Helper to build access context from the request
 */
function getAccessContext(c: any): AccessContext {
  const user = c.get('user');
  return {
    userId: user?.id || null,
    isAuthenticated: !!user,
    roles: user?.roles || [],
    teamIds: [], // Would be populated from user's team memberships
  };
}

/**
 * Helper to extract user context for user-aware branch permissions
 */
function getBranchUserContext(c: any): { userId: string | null; roles: string[] } {
  const user = c.get('user');
  return { userId: user?.id ?? null, roles: user?.roles ?? [] };
}

/**
 * POST /api/v1/branches - Create a new branch
 */
branchRoutes.post(
  '/',
  requireAuth,
  zValidator('json', createBranchBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const branch = await branchService.create(body, user.id);
    return created(c, branch.toResponseForUser(getBranchUserContext(c)));
  }
);

/**
 * GET /api/v1/branches - List branches
 */
branchRoutes.get('/', zValidator('query', listBranchesQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const context = getAccessContext(c);

  // Validate and clean filter values
  const stateFilter = validateStateFilter(query.state);
  const visibilityFilter = validateVisibilityFilter(query.visibility);

  const result = await branchService.list({
    ownerId: query.ownerId,
    state: stateFilter,
    visibility: visibilityFilter,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });

  // Filter branches by visibility
  const accessibleBranches = result.branches.filter((branch) =>
    visibilityService.checkAccess(branch.toJSON(), context).canAccess
  );

  return paginated(
    c,
    accessibleBranches.map((b) => b.toResponseForUser(getBranchUserContext(c))),
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore,
    }
  );
});

/**
 * GET /api/v1/branches/me - Get branches owned by current user
 */
branchRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const includeArchived = c.req.query('includeArchived') === 'true';

  const branches = await branchService.getByOwner(user.id, includeArchived);
  return success(
    c,
    branches.map((b) => b.toResponseForUser(getBranchUserContext(c)))
  );
});

/**
 * GET /api/v1/branches/reviews - Get branches where user is a reviewer
 */
branchRoutes.get('/reviews', requireAuth, async (c) => {
  const user = c.get('user')!;

  const branches = await branchService.getByReviewer(user.id);
  return success(
    c,
    branches.map((b) => b.toResponseForUser(getBranchUserContext(c)))
  );
});

/**
 * GET /api/v1/branches/:id - Get a branch by ID
 */
branchRoutes.get('/:id', zValidator('param', branchIdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const context = getAccessContext(c);

  const branch = await branchService.getById(id);
  if (!branch) {
    throw new NotFoundError('Branch', id);
  }

  // Check access
  visibilityService.assertAccess(branch.toJSON(), context);

  return success(c, branch.toResponseForUser(getBranchUserContext(c)));
});

/**
 * PATCH /api/v1/branches/:id - Update a branch
 */
branchRoutes.patch(
  '/:id',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', updateBranchBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const branch = await branchService.update(id, body, user.id);
    return success(c, branch.toResponseForUser(getBranchUserContext(c)));
  }
);

/**
 * DELETE /api/v1/branches/:id - Delete a branch
 */
branchRoutes.delete(
  '/:id',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    await branchService.delete(id, user.id);
    return noContent(c);
  }
);

/**
 * GET /api/v1/branches/:id/reviewers - Get reviewers for a branch with full details
 */
branchRoutes.get(
  '/:id/reviewers',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    const reviewers = await teamService.getBranchReviewers(id);
    return success(c, reviewers);
  }
);

/**
 * GET /api/v1/branches/:id/reviewers/search - Search for potential reviewers
 */
branchRoutes.get(
  '/:id/reviewers/search',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '10', 10);

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const potentialReviewers = await teamService.searchPotentialReviewers(id, query, limit);
    return success(c, potentialReviewers);
  }
);

/**
 * POST /api/v1/branches/:id/reviewers - Add reviewers to a branch
 * Returns the updated list of reviewers with full details
 */
branchRoutes.post(
  '/:id/reviewers',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', addReviewersBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { reviewerIds } = c.req.valid('json');

    await branchService.addReviewers(id, reviewerIds, user.id);

    // If branch is already in review state, create review records so
    // newly added reviewers appear in the review queue immediately
    const branch = await branchService.getById(id);
    if (branch && branch.state === 'review') {
      await Promise.all(
        reviewerIds.map((reviewerId) =>
          reviewService.create({ branchId: id, reviewerId }, user.id).catch(() => {
            // Ignore duplicates — reviewer may already have an active review record
          })
        )
      );
    }

    const reviewers = await teamService.getBranchReviewers(id);
    return success(c, reviewers);
  }
);

/**
 * DELETE /api/v1/branches/:id/reviewers/:reviewerId - Remove a reviewer
 * Returns the updated list of reviewers with full details
 */
branchRoutes.delete(
  '/:id/reviewers/:reviewerId',
  requireAuth,
  zValidator('param', removeReviewerParamsSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, reviewerId } = c.req.valid('param');

    await branchService.removeReviewer(id, reviewerId, user.id);
    const reviewers = await teamService.getBranchReviewers(id);
    return success(c, reviewers);
  }
);

/**
 * GET /api/v1/branches/:id/collaborators - Get collaborators for a branch with full details
 */
branchRoutes.get(
  '/:id/collaborators',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    const collaborators = await teamService.getBranchCollaborators(id);
    return success(c, collaborators);
  }
);

/**
 * GET /api/v1/branches/:id/collaborators/search - Search for potential collaborators
 */
branchRoutes.get(
  '/:id/collaborators/search',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '10', 10);

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const potentialCollaborators = await teamService.searchPotentialCollaborators(
      id,
      query,
      limit
    );
    return success(c, potentialCollaborators);
  }
);

/**
 * POST /api/v1/branches/:id/collaborators - Add collaborators to a branch
 * Returns the updated list of collaborators with full details
 */
branchRoutes.post(
  '/:id/collaborators',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', addCollaboratorsBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { collaboratorIds } = c.req.valid('json');

    // Add each collaborator
    for (const collaboratorId of collaboratorIds) {
      await teamService.addCollaborator(id, collaboratorId, user.id);
    }

    const collaborators = await teamService.getBranchCollaborators(id);
    return success(c, collaborators);
  }
);

/**
 * DELETE /api/v1/branches/:id/collaborators/:collaboratorId - Remove a collaborator
 * Returns the updated list of collaborators with full details
 */
branchRoutes.delete(
  '/:id/collaborators/:collaboratorId',
  requireAuth,
  zValidator('param', removeCollaboratorParamsSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id, collaboratorId } = c.req.valid('param');

    await teamService.removeCollaborator(id, collaboratorId, user.id);
    const collaborators = await teamService.getBranchCollaborators(id);
    return success(c, collaborators);
  }
);

/**
 * POST /api/v1/branches/:id/submit-for-review - Submit branch for review
 * This is a convenience endpoint that transitions to review state and assigns reviewers
 */
branchRoutes.post(
  '/:id/submit-for-review',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', submitForReviewBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { reviewerIds, reason } = c.req.valid('json');

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // FR-017a: Validate at least one reviewer
    if (reviewerIds.length === 0) {
      throw new ValidationError('At least one reviewer is required');
    }

    // Add reviewers first (validates mutual exclusion)
    await branchService.addReviewers(id, reviewerIds, user.id);

    // Then transition to review state
    const result = await transitionService.executeTransition({
      branchId: id,
      event: TransitionEvent.SUBMIT_FOR_REVIEW,
      actorId: user.id,
      actorRoles: user.roles || [],
      reason,
    });

    if (!result.success) {
      throw new ValidationError(result.error || 'Failed to submit for review');
    }

    // Create review records for ALL reviewers on the branch (not just the
    // ones in this request) so pre-existing reviewers also appear in the queue
    const updatedBranch = await branchService.getById(id);
    const allReviewerIds = updatedBranch?.reviewers ?? reviewerIds;
    await Promise.all(
      allReviewerIds.map((reviewerId) =>
        reviewService.create({ branchId: id, reviewerId }, user.id).catch(() => {
          // Ignore duplicates — reviewer may already have an active review record
        })
      )
    );

    return success(c, result);
  }
);

/**
 * PATCH /api/v1/branches/:id/approval-threshold - Update approval threshold
 * Admin only - Configure per-branch approval threshold (1-10)
 */
branchRoutes.patch(
  '/:id/approval-threshold',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', updateApprovalThresholdBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { requiredApprovals } = c.req.valid('json');

    // Check if user is admin
    if (!user.roles?.includes('administrator')) {
      throw new ForbiddenError('Only administrators can configure approval thresholds');
    }

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Update threshold
    const updated = await branchService.update(
      id,
      { requiredApprovals },
      user.id
    );

    return success(c, updated.toResponseForUser(getBranchUserContext(c)));
  }
);

/**
 * POST /api/v1/branches/:id/publish - Publish a branch
 * Publisher/Admin only - Transition approved branch to published state
 */
branchRoutes.post(
  '/:id/publish',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    // Check if user has publisher or admin role
    const hasPublishRole = user.roles?.includes('publisher') || user.roles?.includes('administrator');
    if (!hasPublishRole) {
      throw new ForbiddenError('Only publishers or administrators can publish branches');
    }

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Check branch is in approved state
    if (branch.state !== 'approved') {
      throw new ValidationError(`Branch must be in approved state to publish (current state: ${branch.state})`);
    }

    // Execute publish transition
    const result = await transitionService.executeTransition({
      branchId: id,
      event: TransitionEvent.PUBLISH,
      actorId: user.id,
      actorRoles: user.roles || [],
    });

    if (!result.success) {
      throw new ValidationError(result.error || 'Failed to publish branch');
    }

    return success(c, result);
  }
);

/**
 * POST /api/v1/branches/:id/transitions - Trigger a state transition
 */
branchRoutes.post(
  '/:id/transitions',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('json', transitionBranchBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const { event, reason, metadata } = c.req.valid('json');

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const context = getAccessContext(c);
    visibilityService.assertAccess(branch.toJSON(), context);

    // Execute the transition
    const result = await transitionService.executeTransition({
      branchId: id,
      event: event as TransitionEventType,
      actorId: user.id,
      actorRoles: user.roles || [],
      reason,
      metadata,
    });

    if (!result.success) {
      throw new ValidationError(result.error || 'Transition failed');
    }

    return success(c, result);
  }
);

/**
 * GET /api/v1/branches/:id/transitions - Get transition history for a branch
 */
branchRoutes.get(
  '/:id/transitions',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    const history = await transitionService.getTransitionHistory(id);
    return success(c, history);
  }
);

/**
 * GET /api/v1/branches/:id/can-transition - Check if a transition is allowed (dry run)
 */
branchRoutes.get(
  '/:id/can-transition',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');
    const event = c.req.query('event') as TransitionEventType | undefined;

    if (!event) {
      throw new ValidationError('Event query parameter is required');
    }

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const result = await transitionService.canTransition({
      branchId: id,
      event,
      actorId: user.id,
      actorRoles: user.roles || [],
    });

    return success(c, result);
  }
);

/**
 * GET /api/v1/branches/:id/diff - Get diff between branch and its base
 */
branchRoutes.get(
  '/:id/diff',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    // Get the diff
    const diff = await diffService.getBranchDiff(
      branch.gitRef,
      branch.baseRef,
      branch.baseCommit,
      branch.headCommit
    );

    return success(c, diff);
  }
);

/**
 * GET /api/v1/branches/:id/diff/summary - Get summary of changes (file list only)
 */
branchRoutes.get(
  '/:id/diff/summary',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    // Get the summary
    const summary = await diffService.getChangeSummary(branch.gitRef, branch.baseRef);

    return success(c, summary);
  }
);

export { branchRoutes };
