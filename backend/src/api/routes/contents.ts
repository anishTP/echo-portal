import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { contentService } from '../../services/content/content-service.js';
import { versionService } from '../../services/content/version-service.js';
import { diffService } from '../../services/content/diff-service.js';
import { referenceService } from '../../services/content/reference-service.js';
import { conflictResolutionService } from '../../services/content/conflict-resolution-service.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success, created, paginated, getPagination } from '../utils/responses.js';
import { branchService } from '../../services/branch/branch-service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  createContentBodySchema,
  updateContentBodySchema,
  revertContentBodySchema,
  contentIdParamSchema,
  contentSlugParamSchema,
  versionIdParamSchema,
  listContentsQuerySchema,
  listPublishedQuerySchema,
  searchContentsQuerySchema,
  diffQuerySchema,
  versionListQuerySchema,
  validateBodySize,
} from '../schemas/contents.js';

const contentRoutes = new Hono<AuthEnv>();

/**
 * Assert the user can edit content in the given branch.
 * Requires draft state and user must be owner, collaborator, or admin.
 */
async function assertCanEditBranchContent(
  branchId: string,
  user: { id: string; roles?: string[] }
): Promise<void> {
  const branch = await branchService.getById(branchId);
  if (!branch) {
    throw new ForbiddenError('Branch not found');
  }
  if (branch.state !== 'draft') {
    throw new ForbiddenError('Content can only be modified in draft branches');
  }
  const isOwner = branch.ownerId === user.id;
  const isCollaborator = branch.collaborators.includes(user.id);
  const isAdmin = user.roles?.includes('administrator') ?? false;
  if (!isOwner && !isCollaborator && !isAdmin) {
    throw new ForbiddenError('You do not have permission to edit content in this branch');
  }
}

/**
 * POST /api/v1/contents - Create content within a branch
 */
contentRoutes.post('/', requireAuth, zValidator('json', createContentBodySchema), async (c) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  // Size limit check
  const sizeCheck = validateBodySize(body.body);
  if (!sizeCheck.valid) {
    return c.json(
      { error: { code: 'CONTENT_TOO_LARGE', message: 'Content body exceeds 50 MB size limit' } },
      413
    );
  }

  // Authorization: user must be owner, collaborator, or admin on a draft branch
  await assertCanEditBranchContent(body.branchId, user);

  try {
    const content = await contentService.create(body, { userId: user.id });
    return created(c, content);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'Branch not found') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    if (err.message.includes('draft')) {
      return c.json({ error: { code: 'INVALID_STATE', message: err.message } }, 403);
    }
    throw error;
  }
});

/**
 * GET /api/v1/contents - List contents in a branch
 */
contentRoutes.get('/', requireAuth, zValidator('query', listContentsQuerySchema), async (c) => {
  const query = c.req.valid('query');

  const result = await contentService.listByBranch(query.branchId, {
    contentType: query.contentType,
    category: query.category,
    page: query.page,
    limit: query.limit,
  });

  return paginated(c, result.items, {
    page: query.page,
    limit: query.limit,
    total: result.total,
    hasMore: (query.page - 1) * query.limit + result.items.length < result.total,
  });
});

/**
 * GET /api/v1/contents/published - List published public content
 */
contentRoutes.get(
  '/published',
  zValidator('query', listPublishedQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    const result = await contentService.listPublished({
      contentType: query.contentType,
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    return paginated(c, result.items, {
      page: query.page,
      limit: query.limit,
      total: result.total,
      hasMore: (query.page - 1) * query.limit + result.items.length < result.total,
    });
  }
);

/**
 * GET /api/v1/contents/published/:slug - Get published content by slug
 */
contentRoutes.get(
  '/published/:slug',
  zValidator('param', contentSlugParamSchema),
  async (c) => {
    const { slug } = c.req.valid('param');

    const content = await contentService.getPublishedBySlug(slug);
    if (!content) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Content not found' } }, 404);
    }

    return success(c, content);
  }
);

/**
 * GET /api/v1/contents/search - Search content
 */
contentRoutes.get(
  '/search',
  zValidator('query', searchContentsQuerySchema),
  async (c) => {
    const query = c.req.valid('query');

    const result = await contentService.search(query.q, {
      contentType: query.contentType,
      page: query.page,
      limit: query.limit,
    });

    return paginated(c, result.items, {
      page: query.page,
      limit: query.limit,
      total: result.total,
      hasMore: (query.page - 1) * query.limit + result.items.length < result.total,
    });
  }
);

/**
 * GET /api/v1/contents/:contentId - Get content with current version
 */
contentRoutes.get('/:contentId', zValidator('param', contentIdParamSchema), async (c) => {
  const { contentId } = c.req.valid('param');

  const content = await contentService.getById(contentId);
  if (!content) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Content not found' } }, 404);
  }

  return success(c, content);
});

/**
 * PUT /api/v1/contents/:contentId - Update content (creates new version)
 */
contentRoutes.put(
  '/:contentId',
  requireAuth,
  zValidator('param', contentIdParamSchema),
  zValidator('json', updateContentBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { contentId } = c.req.valid('param');
    const body = c.req.valid('json');

    // Size limit check
    const sizeCheck = validateBodySize(body.body);
    if (!sizeCheck.valid) {
      return c.json(
        {
          error: { code: 'CONTENT_TOO_LARGE', message: 'Content body exceeds 50 MB size limit' },
        },
        413
      );
    }

    // Authorization: look up content to get branchId, then check permissions
    const existing = await contentService.getById(contentId);
    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Content not found' } }, 404);
    }
    await assertCanEditBranchContent(existing.branchId, user);

    try {
      const content = await contentService.update(contentId, body, { userId: user.id });
      return success(c, content);
    } catch (error: unknown) {
      const err = error as Error & { code?: string; currentVersion?: unknown };
      if (err.message === 'Content not found') {
        return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
      }
      if (err.message.includes('Published content')) {
        return c.json({ error: { code: 'IMMUTABLE', message: err.message } }, 403);
      }
      if (err.message.includes('draft')) {
        return c.json({ error: { code: 'INVALID_STATE', message: err.message } }, 403);
      }
      if (err.code === 'VERSION_CONFLICT') {
        return c.json(
          {
            error: { code: 'VERSION_CONFLICT', message: err.message },
            currentVersion: err.currentVersion,
          },
          409
        );
      }
      throw error;
    }
  }
);

/**
 * GET /api/v1/contents/:contentId/versions - List version history
 */
contentRoutes.get(
  '/:contentId/versions',
  zValidator('param', contentIdParamSchema),
  async (c) => {
    const { contentId } = c.req.valid('param');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));

    const result = await versionService.getVersions(contentId, { page, limit });

    return paginated(c, result.items, {
      page,
      limit,
      total: result.total,
      hasMore: (page - 1) * limit + result.items.length < result.total,
    });
  }
);

/**
 * GET /api/v1/contents/:contentId/versions/:versionId - Get specific version
 */
contentRoutes.get(
  '/:contentId/versions/:versionId',
  zValidator('param', versionIdParamSchema),
  async (c) => {
    const { contentId, versionId } = c.req.valid('param');

    const version = await versionService.getVersion(contentId, versionId);
    if (!version) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
    }

    return success(c, version);
  }
);

/**
 * GET /api/v1/contents/:contentId/diff - Compare two versions
 */
contentRoutes.get(
  '/:contentId/diff',
  zValidator('param', contentIdParamSchema),
  zValidator('query', diffQuerySchema),
  async (c) => {
    const { contentId } = c.req.valid('param');
    const { from, to } = c.req.valid('query');

    try {
      const diff = await diffService.diffVersions(contentId, from, to);
      return success(c, diff);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
      }
      throw error;
    }
  }
);

/**
 * POST /api/v1/contents/:contentId/revert - Revert to a previous version
 */
contentRoutes.post(
  '/:contentId/revert',
  requireAuth,
  zValidator('param', contentIdParamSchema),
  zValidator('json', revertContentBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { contentId } = c.req.valid('param');
    const body = c.req.valid('json');

    // Authorization: look up content to get branchId, then check permissions
    const existingContent = await contentService.getById(contentId);
    if (!existingContent) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Content not found' } }, 404);
    }
    await assertCanEditBranchContent(existingContent.branchId, user);

    try {
      const version = await versionService.revert(
        contentId,
        body.targetVersionTimestamp,
        body.changeDescription,
        { userId: user.id }
      );

      // Re-fetch the full content to return it
      const content = await contentService.getById(contentId);
      return success(c, content);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
      }
      if (err.message.includes('draft')) {
        return c.json({ error: { code: 'INVALID_STATE', message: err.message } }, 403);
      }
      throw error;
    }
  }
);

/**
 * GET /api/v1/contents/:contentId/lineage - Get content lineage
 */
contentRoutes.get(
  '/:contentId/lineage',
  zValidator('param', contentIdParamSchema),
  async (c) => {
    const { contentId } = c.req.valid('param');

    const content = await contentService.getById(contentId);
    if (!content) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Content not found' } }, 404);
    }

    // Get all versions for this content
    const versionsResult = await versionService.getVersions(contentId, { limit: 100 });

    // Build lineage response
    let sourceContent = null;
    if (content.sourceContentId) {
      sourceContent = await contentService.getById(content.sourceContentId);
    }

    return success(c, {
      contentId,
      versions: versionsResult.items,
      sourceContent: sourceContent ?? undefined,
    });
  }
);

/**
 * GET /api/v1/contents/:contentId/references - Get outgoing references
 */
contentRoutes.get(
  '/:contentId/references',
  zValidator('param', contentIdParamSchema),
  async (c) => {
    const { contentId } = c.req.valid('param');

    const references = await referenceService.getReferences(contentId);
    return success(c, references);
  }
);

/**
 * GET /api/v1/contents/:contentId/referenced-by - Get incoming references
 */
contentRoutes.get(
  '/:contentId/referenced-by',
  zValidator('param', contentIdParamSchema),
  async (c) => {
    const { contentId } = c.req.valid('param');

    const references = await referenceService.getReferencedBy(contentId);
    return success(c, references);
  }
);

/**
 * GET /api/v1/contents/:contentId/conflict - Get conflict details for content in conflict state
 */
contentRoutes.get(
  '/:contentId/conflict',
  requireAuth,
  zValidator('param', contentIdParamSchema),
  async (c) => {
    const { contentId } = c.req.valid('param');

    const preview = await conflictResolutionService.getResolutionPreview(contentId);
    if (!preview) {
      return c.json({ error: { code: 'NOT_IN_CONFLICT', message: 'Content is not in conflict state' } }, 400);
    }

    return success(c, preview);
  }
);

// Schema for resolve conflict request
import { z } from 'zod';
const resolveConflictBodySchema = z.object({
  resolution: z.enum(['ours', 'theirs', 'manual']),
  mergedBody: z.string().optional(),
  mergedMetadata: z.object({
    title: z.string().optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().nullable().optional(),
  }).optional(),
  changeDescription: z.string().optional(),
});

/**
 * POST /api/v1/contents/:contentId/resolve-conflict - Resolve a content conflict
 */
contentRoutes.post(
  '/:contentId/resolve-conflict',
  requireAuth,
  zValidator('param', contentIdParamSchema),
  zValidator('json', resolveConflictBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { contentId } = c.req.valid('param');
    const body = c.req.valid('json');

    // Get content to check permissions
    const content = await contentService.getById(contentId);
    if (!content) {
      throw new NotFoundError('Content', contentId);
    }

    // Check user has permission to resolve conflicts
    await assertCanEditBranchContent(content.branchId, user);

    // Validate manual resolution has body
    if (body.resolution === 'manual' && !body.mergedBody) {
      throw new ValidationError('Manual resolution requires mergedBody');
    }

    const result = await conflictResolutionService.resolveConflict(
      {
        contentId,
        resolution: body.resolution,
        mergedBody: body.mergedBody,
        mergedMetadata: body.mergedMetadata,
        changeDescription: body.changeDescription,
      },
      user.id
    );

    if (!result.success) {
      return c.json({ error: { code: 'RESOLUTION_FAILED', message: result.error } }, 400);
    }

    // Return updated content
    const updatedContent = await contentService.getById(contentId);
    return success(c, updatedContent);
  }
);

export { contentRoutes };
