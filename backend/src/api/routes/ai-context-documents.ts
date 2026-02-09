import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { aiContextDocumentService } from '../../services/ai/ai-context-service.js';
import { AuditLogger } from '../../services/audit/logger.js';
import {
  createContextDocSchema,
  updateContextDocSchema,
  contextDocIdParamSchema,
} from '../schemas/ai-context-document-schemas.js';

const auditLogger = new AuditLogger();

export const aiContextDocRoutes = new Hono<AuthEnv>();

function requireAdmin(user: { roles?: string[] }): void {
  if (!user.roles?.includes('administrator')) {
    throw Object.assign(new Error('Administrator access required'), { status: 403 });
  }
}

/**
 * GET /api/v1/ai/context-documents — List all context documents (admin only)
 */
aiContextDocRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  try {
    requireAdmin(user);
    const documents = await aiContextDocumentService.list();
    return c.json({ data: documents });
  } catch (error: any) {
    if (error.status === 403) {
      return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
    }
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch context documents' } }, 500);
  }
});

/**
 * POST /api/v1/ai/context-documents — Create a context document (admin only)
 */
aiContextDocRoutes.post(
  '/',
  requireAuth,
  zValidator('json', createContextDocSchema),
  async (c) => {
    const user = c.get('user')!;
    try {
      requireAdmin(user);
      const body = c.req.valid('json');
      const doc = await aiContextDocumentService.create(body, user.id);

      await auditLogger.log({
        action: 'ai.context_document_created',
        actorId: user.id,
        actorType: 'user',
        resourceType: 'content',
        resourceId: doc.id,
        metadata: { title: doc.title },
      });

      return c.json({ data: doc }, 201);
    } catch (error: any) {
      if (error.status === 403) {
        return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create context document' } }, 500);
    }
  }
);

/**
 * PUT /api/v1/ai/context-documents/:id — Update a context document (admin only)
 */
aiContextDocRoutes.put(
  '/:id',
  requireAuth,
  zValidator('param', contextDocIdParamSchema),
  zValidator('json', updateContextDocSchema),
  async (c) => {
    const user = c.get('user')!;
    try {
      requireAdmin(user);
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');

      const doc = await aiContextDocumentService.update(id, body, user.id);
      if (!doc) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Context document not found' } }, 404);
      }

      await auditLogger.log({
        action: 'ai.context_document_updated',
        actorId: user.id,
        actorType: 'user',
        resourceType: 'content',
        resourceId: doc.id,
        metadata: { title: doc.title, changes: Object.keys(body) },
      });

      return c.json({ data: doc });
    } catch (error: any) {
      if (error.status === 403) {
        return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update context document' } }, 500);
    }
  }
);

/**
 * DELETE /api/v1/ai/context-documents/:id — Delete a context document (admin only)
 */
aiContextDocRoutes.delete(
  '/:id',
  requireAuth,
  zValidator('param', contextDocIdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    try {
      requireAdmin(user);
      const { id } = c.req.valid('param');

      const existing = await aiContextDocumentService.getById(id);
      if (!existing) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Context document not found' } }, 404);
      }

      await aiContextDocumentService.delete(id);

      await auditLogger.log({
        action: 'ai.context_document_deleted',
        actorId: user.id,
        actorType: 'user',
        resourceType: 'content',
        resourceId: id,
        metadata: { title: existing.title },
      });

      return c.json({ success: true });
    } catch (error: any) {
      if (error.status === 403) {
        return c.json({ error: { code: 'FORBIDDEN', message: error.message } }, 403);
      }
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete context document' } }, 500);
    }
  }
);
