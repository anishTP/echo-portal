import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success } from '../utils/responses.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { branchService } from '../../services/branch/branch-service.js';
import { contentRebaseService } from '../../services/content/content-rebase-service.js';

const rebaseRoutes = new Hono<AuthEnv>();

// Param schema for branch ID
const branchIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * GET /api/v1/branches/:id/rebase-preview - Preview rebase changes
 */
rebaseRoutes.get(
  '/:id/rebase-preview',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user')!;

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Check user has permission (owner, collaborator, or admin)
    const isOwner = branch.ownerId === user.id;
    const isCollaborator = branch.collaborators.includes(user.id);
    const isAdmin = user.roles?.includes('administrator') ?? false;

    if (!isOwner && !isCollaborator && !isAdmin) {
      throw new ForbiddenError('You do not have permission to rebase this branch');
    }

    // Check branch is in draft state
    if (branch.state !== 'draft') {
      throw new ValidationError('Only draft branches can be rebased');
    }

    const preview = await contentRebaseService.previewRebase(id);
    return success(c, preview);
  }
);

/**
 * POST /api/v1/branches/:id/rebase - Execute rebase
 */
rebaseRoutes.post(
  '/:id/rebase',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user')!;

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Check user has permission
    const isOwner = branch.ownerId === user.id;
    const isCollaborator = branch.collaborators.includes(user.id);
    const isAdmin = user.roles?.includes('administrator') ?? false;

    if (!isOwner && !isCollaborator && !isAdmin) {
      throw new ForbiddenError('You do not have permission to rebase this branch');
    }

    // Check branch is in draft state
    if (branch.state !== 'draft') {
      throw new ValidationError('Only draft branches can be rebased');
    }

    const result = await contentRebaseService.rebase(id, user.id);
    return success(c, result);
  }
);

/**
 * POST /api/v1/branches/:id/rebase/continue - Continue rebase after conflict resolution
 */
rebaseRoutes.post(
  '/:id/rebase/continue',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user')!;

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Check user has permission
    const isOwner = branch.ownerId === user.id;
    const isCollaborator = branch.collaborators.includes(user.id);
    const isAdmin = user.roles?.includes('administrator') ?? false;

    if (!isOwner && !isCollaborator && !isAdmin) {
      throw new ForbiddenError('You do not have permission to continue the rebase');
    }

    // Check if rebase is in progress
    if (!contentRebaseService.isRebaseInProgress(id)) {
      throw new ValidationError('No rebase in progress for this branch');
    }

    const result = await contentRebaseService.continueRebase(id, user.id);
    return success(c, result);
  }
);

/**
 * POST /api/v1/branches/:id/rebase/abort - Abort in-progress rebase
 */
rebaseRoutes.post(
  '/:id/rebase/abort',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user')!;

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Check user has permission
    const isOwner = branch.ownerId === user.id;
    const isCollaborator = branch.collaborators.includes(user.id);
    const isAdmin = user.roles?.includes('administrator') ?? false;

    if (!isOwner && !isCollaborator && !isAdmin) {
      throw new ForbiddenError('You do not have permission to abort the rebase');
    }

    // Check if rebase is in progress
    if (!contentRebaseService.isRebaseInProgress(id)) {
      throw new ValidationError('No rebase in progress for this branch');
    }

    await contentRebaseService.abortRebase(id);
    return success(c, { message: 'Rebase aborted' });
  }
);

/**
 * GET /api/v1/branches/:id/rebase/status - Get rebase status
 */
rebaseRoutes.get(
  '/:id/rebase/status',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user')!;

    // Check branch exists
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    const isInProgress = contentRebaseService.isRebaseInProgress(id);
    const rebaseState = contentRebaseService.getRebaseState(id);

    return success(c, {
      isInProgress,
      conflictCount: rebaseState?.conflicts.length ?? 0,
      resolvedCount: rebaseState?.resolvedConflicts.size ?? 0,
      startedAt: rebaseState?.startedAt.toISOString() ?? null,
    });
  }
);

export { rebaseRoutes };
