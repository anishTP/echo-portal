import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { comparisonService } from '../../services/review/comparison-service.js';
import { contentComparisonService } from '../../services/review/content-comparison-service.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success } from '../utils/responses.js';
import { NotFoundError } from '../utils/errors.js';

const comparisonRoutes = new Hono<AuthEnv>();

// Parameter schemas
const branchIdParamSchema = z.object({
  branchId: z.string().uuid(),
});

const filePathParamSchema = z.object({
  branchId: z.string().uuid(),
  filePath: z.string().min(1),
});

const comparisonQuerySchema = z.object({
  snapshotId: z.string().uuid().optional(),
});

/**
 * GET /api/v1/branches/:branchId/comparison
 * Get branch comparison for review
 *
 * Returns the diff between the branch head and its base state.
 * Includes divergence detection if the base has moved since branch creation.
 */
comparisonRoutes.get(
  '/branches/:branchId/comparison',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  zValidator('query', comparisonQuerySchema),
  async (c) => {
    const { branchId } = c.req.valid('param');
    const { snapshotId } = c.req.valid('query');

    const comparison = await comparisonService.getBranchComparison(branchId, snapshotId);
    return success(c, comparison);
  }
);

/**
 * GET /api/v1/branches/:branchId/comparison/files/:filePath
 * Get diff for a specific file
 *
 * Returns detailed diff for a single file, useful for large comparisons.
 */
comparisonRoutes.get(
  '/branches/:branchId/comparison/files/:filePath',
  requireAuth,
  zValidator('param', filePathParamSchema),
  zValidator('query', comparisonQuerySchema),
  async (c) => {
    const { branchId, filePath } = c.req.valid('param');
    const { snapshotId } = c.req.valid('query');

    // Decode the URL-encoded file path
    const decodedPath = decodeURIComponent(filePath);

    const fileDiff = await comparisonService.getFileDiff(branchId, decodedPath, snapshotId);
    if (!fileDiff) {
      throw new NotFoundError('File', decodedPath);
    }

    return success(c, fileDiff);
  }
);

/**
 * GET /api/v1/branches/:branchId/content-comparison
 * Get DB-backed content comparison for a branch
 *
 * Compares content bodies stored in PostgreSQL instead of git worktrees.
 * Returns diffs for all modified/added content items in the branch.
 */
comparisonRoutes.get(
  '/branches/:branchId/content-comparison',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { branchId } = c.req.valid('param');
    const comparison = await contentComparisonService.getContentComparison(branchId);
    return success(c, comparison);
  }
);

/**
 * GET /api/v1/branches/:branchId/content-comparison/stats
 * Get lightweight content comparison stats for sidebar display
 *
 * Returns per-item addition/deletion counts without full hunk data.
 */
comparisonRoutes.get(
  '/branches/:branchId/content-comparison/stats',
  requireAuth,
  zValidator('param', branchIdParamSchema),
  async (c) => {
    const { branchId } = c.req.valid('param');
    const stats = await contentComparisonService.getContentComparisonStats(branchId);
    return success(c, stats);
  }
);

export { comparisonRoutes };
