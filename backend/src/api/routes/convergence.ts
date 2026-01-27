import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { convergenceService } from '../../services/convergence/convergence-service.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, created, noContent } from '../utils/responses.js';
import { NotFoundError } from '../utils/errors.js';
import {
  createConvergenceBodySchema,
  validateConvergenceBodySchema,
  convergenceIdParamSchema,
} from '../schemas/convergence.js';

const convergenceRoutes = new Hono<AuthEnv>();

/**
 * POST /api/v1/convergence - Initiate a convergence operation
 */
convergenceRoutes.post(
  '/',
  requireAuth,
  zValidator('json', createConvergenceBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const operation = await convergenceService.create(
      body,
      user.id,
      user.roles || []
    );
    return created(c, operation.toResponse());
  }
);

/**
 * POST /api/v1/convergence/validate - Validate a branch for convergence
 */
convergenceRoutes.post(
  '/validate',
  requireAuth,
  zValidator('json', validateConvergenceBodySchema),
  async (c) => {
    const body = c.req.valid('json');

    const result = await convergenceService.validate(body.branchId);
    return success(c, result);
  }
);

/**
 * GET /api/v1/convergence/:id - Get a convergence operation by ID
 */
convergenceRoutes.get(
  '/:id',
  requireAuth,
  zValidator('param', convergenceIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const operation = await convergenceService.getById(id);
    if (!operation) {
      throw new NotFoundError('Convergence', id);
    }

    return success(c, operation.toResponse());
  }
);

/**
 * GET /api/v1/convergence/:id/status - Get the status of a convergence operation
 */
convergenceRoutes.get(
  '/:id/status',
  requireAuth,
  zValidator('param', convergenceIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const operation = await convergenceService.getById(id);
    if (!operation) {
      throw new NotFoundError('Convergence', id);
    }

    return success(c, {
      id: operation.id,
      status: operation.status,
      isInProgress: operation.isInProgress(),
      isComplete: operation.isComplete(),
      isSucceeded: operation.isSucceeded(),
      conflictDetected: operation.conflictDetected,
      mergeCommit: operation.mergeCommit,
    });
  }
);

/**
 * POST /api/v1/convergence/:id/execute - Execute a pending convergence operation
 */
convergenceRoutes.post(
  '/:id/execute',
  requireAuth,
  zValidator('param', convergenceIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    const operation = await convergenceService.execute(
      id,
      user.id,
      user.roles || []
    );
    return success(c, operation.toResponse());
  }
);

/**
 * POST /api/v1/convergence/:id/cancel - Cancel a pending convergence operation
 */
convergenceRoutes.post(
  '/:id/cancel',
  requireAuth,
  zValidator('param', convergenceIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const { id } = c.req.valid('param');

    const operation = await convergenceService.cancel(id, user.id);
    return success(c, operation.toResponse());
  }
);

/**
 * GET /api/v1/convergence/branch/:branchId - Get convergence operations for a branch
 */
convergenceRoutes.get(
  '/branch/:branchId',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const operations = await convergenceService.getByBranch(branchId);
    return success(
      c,
      operations.map((op) => op.toResponse())
    );
  }
);

/**
 * GET /api/v1/convergence/branch/:branchId/latest - Get the latest convergence for a branch
 */
convergenceRoutes.get(
  '/branch/:branchId/latest',
  requireAuth,
  async (c) => {
    const branchId = c.req.param('branchId');

    const operation = await convergenceService.getLatest(branchId);
    if (!operation) {
      throw new NotFoundError('No convergence operation found for this branch');
    }

    return success(c, operation.toResponse());
  }
);

export { convergenceRoutes };
