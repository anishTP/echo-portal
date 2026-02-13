import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { branchService } from '../../services/branch/branch-service.js';
import { visibilityService, type AccessContext } from '../../services/branch/visibility.js';
import { teamService } from '../../services/branch/team.js';
import { transitionService } from '../../services/workflow/transitions.js';
import { reviewService } from '../../services/review/review-service.js';
import { diffService } from '../../services/git/diff.js';
import { contentMergeService } from '../../services/content/content-merge-service.js';
import { conflictResolutionService } from '../../services/content/conflict-resolution-service.js';
import { contentService } from '../../services/content/content-service.js';
import { contentInheritanceService } from '../../services/content/content-inheritance-service.js';
import { auditLogger } from '../../services/audit/logger.js';
import { notifyCollaboratorAdded, notifyCollaboratorRemoved, notifyContentPublished, notifyBranchArchived } from '../../services/notification/notification-triggers.js';
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
  editBranchCreateBodySchema,
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
 * Helper to check if a branch has content and edited content (for canSubmitForReview permission)
 * Returns hasContent (any content exists), hasEditedContent (backward compat), and hasBranchChanges
 * (true if content was added, modified, or deleted compared to branch creation snapshot)
 */
async function checkBranchHasContent(branchId: string): Promise<{
  hasContent: boolean;
  hasEditedContent: boolean;
  hasBranchChanges: boolean;
}> {
  const [contentResult, branchDiff] = await Promise.all([
    contentService.listByBranch(branchId, { limit: 1 }),
    contentInheritanceService.computeBranchDiff(branchId),
  ]);

  return {
    hasContent: contentResult.total > 0,
    hasEditedContent: branchDiff.hasChanges, // Use diff for backward compat
    hasBranchChanges: branchDiff.hasChanges,
  };
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
 * POST /api/v1/branches/edit - Create a branch for editing published content
 * Creates a new branch forked from main, copying the specified content.
 */
branchRoutes.post(
  '/edit',
  requireAuth,
  zValidator('json', editBranchCreateBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    // Verify source content exists and is published
    const sourceContent = await contentService.getPublishedById(body.sourceContentId);
    if (!sourceContent) {
      throw new NotFoundError('Published content', body.sourceContentId);
    }

    // Create the edit branch with copied content
    const result = await branchService.createEditBranch(body, user.id);

    // Audit log: edit branch created (T055)
    await auditLogger.logContentEditEvent(
      'edit_branch_created',
      result.content.id,
      user.id,
      {
        branchId: result.branch.id,
        branchName: result.branch.name,
        sourceContentId: body.sourceContentId,
      }
    );

    return created(c, result);
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

  console.log('[GET /branches/:id] Fetching branch:', id);
  const branch = await branchService.getById(id);
  console.log('[GET /branches/:id] Branch state from DB:', branch?.state);
  if (!branch) {
    throw new NotFoundError('Branch', id);
  }

  // Check access
  visibilityService.assertAccess(branch.toJSON(), context);

  // Check if branch has content and edited content (for canSubmitForReview permission)
  const { hasContent, hasBranchChanges } = await checkBranchHasContent(id);

  const response = branch.toResponseForUser({ ...getBranchUserContext(c), hasContent, hasEditedContent: hasBranchChanges });

  // Embed review records from the reviews table so the branch page
  // shows the same review data as the review queue (single source of truth)
  const branchReviews = await reviewService.getByBranch(id);
  response.reviews = branchReviews.map((r) => r.toResponse());

  return success(c, response);
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
    const { hasContent, hasBranchChanges } = await checkBranchHasContent(id);
    return success(c, branch.toResponseForUser({ ...getBranchUserContext(c), hasContent, hasEditedContent: hasBranchChanges }));
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

    await branchService.delete(id, user.id, user.roles);
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
    const branch = await branchService.getById(id);
    for (const collaboratorId of collaboratorIds) {
      await teamService.addCollaborator(id, collaboratorId, user.id);
      notifyCollaboratorAdded(id, collaboratorId, branch?.name || id, user.id);
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

    const branchForNotif = await branchService.getById(id);
    await teamService.removeCollaborator(id, collaboratorId, user.id);
    notifyCollaboratorRemoved(id, collaboratorId, branchForNotif?.name || id, user.id);
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

    // Add reviewers first (validates mutual exclusion) - returns branch with all reviewers
    const branchWithReviewers = await branchService.addReviewers(id, reviewerIds, user.id);
    const allReviewerIds = branchWithReviewers.reviewers ?? reviewerIds;

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

    // Create review records for ALL reviewers BEFORE fetching branch
    // (prevents auto-repair from triggering due to missing pending reviews)
    await Promise.all(
      allReviewerIds.map((reviewerId) =>
        reviewService.create({ branchId: id, reviewerId }, user.id).catch((err) => {
          // Only ignore duplicate/conflict errors — not permission or other failures
          if (err?.code === 'CONFLICT' || err?.message?.includes('already exists')) {
            return null; // Duplicate review record, safe to ignore
          }
          console.error(`[submit-for-review] Failed to create review for reviewer ${reviewerId}:`, err);
          return null;
        })
      )
    );

    // Audit log: branch submitted for review (T055)
    await auditLogger.logBranchEvent(
      'branch_state_transitioned',
      id,
      user.id,
      'user',
      {
        fromState: 'draft',
        toState: 'in_review',
        reviewerIds: allReviewerIds,
        reason,
      }
    );

    // Return the updated branch to avoid race condition with refetch
    const freshBranch = await branchService.getById(id);
    const { hasContent, hasBranchChanges } = await checkBranchHasContent(id);
    const branchResponse = freshBranch?.toResponseForUser({
      ...getBranchUserContext(c),
      hasContent,
      hasEditedContent: hasBranchChanges,
    });

    return success(c, {
      transition: result,
      branch: branchResponse,
    });
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

    const { hasContent, hasBranchChanges } = await checkBranchHasContent(id);
    return success(c, updated.toResponseForUser({ ...getBranchUserContext(c), hasContent, hasEditedContent: hasBranchChanges }));
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

    // Merge content to main branch
    const mainBranch = await branchService.getMainBranch();
    if (mainBranch) {
      await contentMergeService.mergeContentIntoMain(
        id,
        mainBranch.id,
        user.id
      );
    }

    // Mark all content in the branch as published
    await contentService.markPublished(id, user.id);

    // Notify branch owner + collaborators about publication
    const publishRecipients = [branch.ownerId, ...(branch.collaborators || [])];
    notifyContentPublished(id, branch.name, publishRecipients, user.id);

    // Auto-archive the branch after publishing (no further edits allowed)
    await transitionService.executeTransition({
      branchId: id,
      event: TransitionEvent.ARCHIVE,
      actorId: user.id,
      actorRoles: user.roles || [],
      reason: 'Auto-archived after publishing',
    });

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

    // Send archive notification if this was an explicit ARCHIVE transition
    if (event === TransitionEvent.ARCHIVE) {
      notifyBranchArchived(id, branch.name, branch.ownerId, user.id);
    }

    // If this was a PUBLISH transition, merge content to main and mark as published
    if (event === TransitionEvent.PUBLISH) {
      // Get main branch to merge content into
      const mainBranch = await branchService.getMainBranch();
      if (mainBranch) {
        // Merge content to main branch with visibility='public'
        await contentMergeService.mergeContentIntoMain(
          id,
          mainBranch.id,
          user.id
        );
      }

      // Mark branch content as published (for tracking purposes)
      await contentService.markPublished(id, user.id);

      // Auto-archive the branch after publishing (no further edits allowed)
      await transitionService.executeTransition({
        branchId: id,
        event: TransitionEvent.ARCHIVE,
        actorId: user.id,
        actorRoles: user.roles || [],
        reason: 'Auto-archived after publishing',
      });
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
 * GET /api/v1/branches/:id/merge-preview - Preview content merge conflicts
 */
branchRoutes.get(
  '/:id/merge-preview',
  requireAuth,
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

    // Get main branch for merge preview
    const mainBranch = await branchService.getMainBranch();
    if (!mainBranch) {
      throw new ValidationError('Main branch not found');
    }

    const preview = await contentMergeService.detectConflicts(id, mainBranch.id);
    return success(c, preview);
  }
);

/**
 * GET /api/v1/branches/:id/conflicts - Get all content conflicts for a branch
 */
branchRoutes.get(
  '/:id/conflicts',
  requireAuth,
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

    const conflicts = await conflictResolutionService.getConflicts(id);
    return success(c, { conflicts, count: conflicts.length });
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

/**
 * POST /api/v1/branches/:id/repair - Repair a stuck branch (admin only)
 * Fixes branches that are stuck in 'review' state after changes were requested
 * but the transition failed.
 */
branchRoutes.post(
  '/:id/repair',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    // Only admins or branch owner can repair
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const isAdmin = user.roles?.includes('administrator');
    const isOwner = branch.ownerId === user.id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError('Only administrators or the branch owner can repair a branch');
    }

    // Check if branch needs repair (stuck in review with changes_requested)
    if (branch.state !== 'review') {
      throw new ValidationError(`Branch is in '${branch.state}' state, not stuck in review`);
    }

    // Check if there's a completed review with changes_requested
    const branchReviews = await reviewService.getByBranch(id);
    const hasChangesRequested = branchReviews.some(
      (r) => r.status === 'completed' && r.decision === 'changes_requested'
    );

    if (!hasChangesRequested) {
      throw new ValidationError(
        'Branch does not have any reviews with changes requested. Use normal transitions instead.'
      );
    }

    // Directly repair the branch state (bypassing normal transition guards)
    const updatedBranch = await branchService.repairStuckBranch(id, user.id);

    const { hasContent, hasBranchChanges } = await checkBranchHasContent(id);
    return success(c, {
      message: 'Branch repaired successfully. Branch is now in draft state.',
      branch: updatedBranch.toResponseForUser({ ...getBranchUserContext(c), hasContent, hasEditedContent: hasBranchChanges }),
    });
  }
);

export { branchRoutes };
