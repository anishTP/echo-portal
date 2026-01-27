import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { branchService } from '../../services/branch/branch-service.js';
import { diffService } from '../../services/git/diff.js';
import { success } from '../utils/responses.js';
import { NotFoundError, AccessDeniedError } from '../utils/errors.js';
import { branchIdParamSchema } from '../schemas/branches.js';
import { BranchState, Visibility } from '@echo-portal/shared';

const publicRoutes = new Hono();

/**
 * GET /api/v1/public/branches/:id - Get a public branch (no auth required)
 * Only allows access to published branches with public visibility
 */
publicRoutes.get(
  '/branches/:id',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Only allow access to published branches with public visibility
    if (branch.state !== BranchState.PUBLISHED) {
      throw new AccessDeniedError(
        'This branch is not published',
        {
          reason: 'Only published branches can be accessed anonymously',
          currentState: branch.state,
          action: 'Please sign in to access draft or in-review branches, or wait for the branch to be published.',
        }
      );
    }

    if (branch.visibility !== Visibility.PUBLIC) {
      throw new AccessDeniedError(
        'This branch is not public',
        {
          reason: 'This branch has restricted visibility',
          visibility: branch.visibility,
          action: 'Please sign in to access this content, or contact the branch owner for access.',
        }
      );
    }

    return success(c, branch.toResponse());
  }
);

/**
 * GET /api/v1/public/branches/:id/diff - Get diff for a public branch
 */
publicRoutes.get(
  '/branches/:id/diff',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Only allow access to published branches with public visibility
    if (branch.state !== BranchState.PUBLISHED) {
      throw new AccessDeniedError(
        'This branch is not published',
        {
          reason: 'Only published branches can be accessed anonymously',
          currentState: branch.state,
          action: 'Please sign in to access draft or in-review branches, or wait for the branch to be published.',
        }
      );
    }

    if (branch.visibility !== Visibility.PUBLIC) {
      throw new AccessDeniedError(
        'This branch is not public',
        {
          reason: 'This branch has restricted visibility',
          visibility: branch.visibility,
          action: 'Please sign in to access this content, or contact the branch owner for access.',
        }
      );
    }

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
 * GET /api/v1/public/branches/:id/diff/summary - Get change summary for a public branch
 */
publicRoutes.get(
  '/branches/:id/diff/summary',
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    // Only allow access to published branches with public visibility
    if (branch.state !== BranchState.PUBLISHED) {
      throw new AccessDeniedError(
        'This branch is not published',
        {
          reason: 'Only published branches can be accessed anonymously',
          currentState: branch.state,
          action: 'Please sign in to access draft or in-review branches, or wait for the branch to be published.',
        }
      );
    }

    if (branch.visibility !== Visibility.PUBLIC) {
      throw new AccessDeniedError(
        'This branch is not public',
        {
          reason: 'This branch has restricted visibility',
          visibility: branch.visibility,
          action: 'Please sign in to access this content, or contact the branch owner for access.',
        }
      );
    }

    // Get the summary
    const summary = await diffService.getChangeSummary(branch.gitRef, branch.baseRef);

    return success(c, summary);
  }
);

export { publicRoutes };
