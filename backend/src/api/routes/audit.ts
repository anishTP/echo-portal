import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { auditQueryService } from '../../services/audit/query.js';
import { lineageService } from '../../services/audit/lineage.js';
import { branchService } from '../../services/branch/branch-service.js';
import { visibilityService, type AccessContext } from '../../services/branch/visibility.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, paginated } from '../utils/responses.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import {
  auditQuerySchema,
  branchHistoryParamsSchema,
  branchHistoryQuerySchema,
  auditStatsQuerySchema,
  lineageQuerySchema,
  branchTreeQuerySchema,
} from '../schemas/audit.js';

const auditRoutes = new Hono<AuthEnv>();

/**
 * Helper to build access context from the request
 */
function getAccessContext(c: any): AccessContext {
  const user = c.get('user');
  return {
    userId: user?.id || null,
    isAuthenticated: !!user,
    roles: user?.roles || [],
    teamIds: [],
  };
}

/**
 * GET /api/v1/audit - Query audit logs
 * Requires authentication and admin/reviewer role
 */
auditRoutes.get(
  '/',
  requireAuth,
  zValidator('query', auditQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    // Only admins and reviewers can query audit logs
    if (!user.roles.includes('administrator') && !user.roles.includes('reviewer')) {
      throw new ForbiddenError('Insufficient permissions to view audit logs');
    }

    const result = await auditQueryService.query({
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorId: query.actorId,
      actions: query.actions,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page,
      limit: query.limit,
    });

    return paginated(c, result.entries, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore,
    });
  }
);

/**
 * GET /api/v1/audit/stats - Get audit statistics
 * Requires authentication and admin role
 */
auditRoutes.get(
  '/stats',
  requireAuth,
  zValidator('query', auditStatsQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    // Only admins can view stats
    if (!user.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to view audit statistics');
    }

    const stats = await auditQueryService.getStats({
      startDate: query.startDate,
      endDate: query.endDate,
      resourceType: query.resourceType,
    });

    return success(c, stats);
  }
);

/**
 * GET /api/v1/audit/my-activity - Get current user's activity
 */
auditRoutes.get('/my-activity', requireAuth, async (c) => {
  const user = c.get('user')!;
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const activity = await auditQueryService.getUserActivity(user.id, { limit });
  return success(c, activity);
});

/**
 * GET /api/v1/branches/:id/history - Get audit history for a branch
 */
auditRoutes.get(
  '/branches/:id/history',
  zValidator('param', branchHistoryParamsSchema),
  zValidator('query', branchHistoryQuerySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { limit, includeRelated } = c.req.valid('query');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    // Get history
    const history = includeRelated
      ? await auditQueryService.getBranchFullHistory(id, { limit })
      : await auditQueryService.getResourceHistory('branch', id, { limit });

    return success(c, history);
  }
);

/**
 * GET /api/v1/branches/:id/lineage - Get lineage for a branch
 */
auditRoutes.get(
  '/branches/:id/lineage',
  zValidator('param', branchHistoryParamsSchema),
  zValidator('query', lineageQuerySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    const lineage = await lineageService.getBranchLineage(id);
    if (!lineage) {
      throw new NotFoundError('Branch lineage', id);
    }

    return success(c, lineage);
  }
);

/**
 * GET /api/v1/branches/:id/timeline - Get state timeline for a branch
 */
auditRoutes.get(
  '/branches/:id/timeline',
  zValidator('param', branchHistoryParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const context = getAccessContext(c);

    // Check branch exists and user has access
    const branch = await branchService.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }

    visibilityService.assertAccess(branch.toJSON(), context);

    const timeline = await lineageService.getStateTimeline(id);
    return success(c, timeline);
  }
);

/**
 * GET /api/v1/audit/branch-tree - Get branch tree visualization
 */
auditRoutes.get(
  '/branch-tree',
  zValidator('query', branchTreeQuerySchema),
  async (c) => {
    const { baseRef, limit, includeArchived } = c.req.valid('query');

    const tree = await lineageService.getBranchTree(baseRef, {
      limit,
      includeArchived,
    });

    return success(c, tree);
  }
);

/**
 * GET /api/v1/audit/failed-logins - Get failed login report (T085)
 * Requires authentication and admin role
 */
auditRoutes.get(
  '/failed-logins',
  requireAuth,
  zValidator('query', auditStatsQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    // Only admins can view security reports
    if (!user.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to view security reports');
    }

    const report = await auditQueryService.getFailedLoginReport({
      startDate: query.startDate,
      endDate: query.endDate,
      limit: 100,
    });

    return success(c, report);
  }
);

/**
 * GET /api/v1/audit/permission-denials - Get permission denial report (T086)
 * Requires authentication and admin role
 */
auditRoutes.get(
  '/permission-denials',
  requireAuth,
  zValidator('query', auditStatsQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const query = c.req.valid('query');

    // Only admins can view security reports
    if (!user.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to view security reports');
    }

    const report = await auditQueryService.getPermissionDenialReport({
      startDate: query.startDate,
      endDate: query.endDate,
      resourceType: query.resourceType,
      limit: 100,
    });

    return success(c, report);
  }
);

export { auditRoutes };
