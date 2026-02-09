import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success } from '../utils/responses.js';
import { aiRateLimitMiddleware } from '../middleware/ai-rate-limit.js';
import { aiService, AIServiceError } from '../../services/ai/ai-service.js';
import { conversationService } from '../../services/ai/conversation-service.js';
import { versionService } from '../../services/content/version-service.js';
import { branchService } from '../../services/branch/branch-service.js';
import { providerRegistry } from '../../services/ai/provider-registry.js';
import { db, schema } from '../../db/index.js';
import { createMetadataSnapshot } from '../../models/content.js';
import {
  aiGenerateBodySchema,
  aiTransformBodySchema,
  aiAcceptBodySchema,
  aiRejectBodySchema,
  aiRequestIdParamSchema,
  aiConversationQuerySchema,
  aiConversationIdParamSchema,
} from '../schemas/ai-schemas.js';
import type { AIStreamMetaEvent } from '@echo-portal/shared';

export const aiRoutes = new Hono<AuthEnv>();

/**
 * Shared authorization: check user can edit branch content (draft state + permissions)
 */
async function assertCanEditBranch(
  branchId: string,
  user: { id: string; roles?: string[] }
): Promise<void> {
  const branch = await branchService.getById(branchId);
  if (!branch) {
    throw new AIServiceError('NOT_FOUND', 'Branch not found', 404);
  }
  if (branch.state !== 'draft') {
    throw new AIServiceError('INVALID_STATE', 'AI assistance is only available on draft branches', 409);
  }
  const isOwner = branch.ownerId === user.id;
  const isCollaborator = branch.collaborators.includes(user.id);
  const isAdmin = user.roles?.includes('administrator') ?? false;
  if (!isOwner && !isCollaborator && !isAdmin) {
    throw new AIServiceError('FORBIDDEN', 'You do not have edit permission on this branch', 403);
  }
}

/**
 * Helper to handle AIServiceError in route handlers
 */
function handleAIError(c: any, error: unknown) {
  if (error instanceof AIServiceError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
  }
  console.error('[AI Route Error]', error);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, 500);
}

// ==========================================
// T014: POST /generate — SSE streaming
// ==========================================
aiRoutes.post(
  '/generate',
  requireAuth,
  aiRateLimitMiddleware,
  zValidator('json', aiGenerateBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');
    const sessionId = c.get('sessionId') ?? 'dev-session';

    try {
      await assertCanEditBranch(body.branchId, user);

      const { request, stream, conversationId } = await aiService.generate({
        userId: user.id,
        branchId: body.branchId,
        contentId: body.contentId,
        prompt: body.prompt,
        conversationId: body.conversationId,
        context: body.context,
        mode: body.mode,
        sessionId,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const provider = providerRegistry.getDefault();

      return streamSSE(c, async (sseStream) => {
        // Send meta event
        const meta: AIStreamMetaEvent = {
          requestId: request.id,
          conversationId,
          providerId: provider?.id ?? 'unknown',
          modelId: provider?.id ?? 'unknown',
        };
        await sseStream.writeSSE({ data: JSON.stringify(meta), event: 'meta' });

        // Stream tokens
        let fullContent = '';
        let tokensUsed = 0;
        for await (const chunk of stream) {
          if (chunk.type === 'token' && chunk.content) {
            fullContent += chunk.content;
            await sseStream.writeSSE({
              data: JSON.stringify({ content: chunk.content }),
              event: 'token',
            });
          }
          if (chunk.type === 'done') {
            tokensUsed = chunk.metadata?.tokensUsed ?? 0;
          }
          if (chunk.type === 'error') {
            await sseStream.writeSSE({
              data: JSON.stringify({ code: 'PROVIDER_ERROR', message: chunk.error }),
              event: 'error',
            });
            return;
          }
        }

        // Send done event
        await sseStream.writeSSE({
          data: JSON.stringify({
            requestId: request.id,
            tokensUsed,
            fullContent,
          }),
          event: 'done',
        });
      });
    } catch (error) {
      return handleAIError(c, error);
    }
  }
);

// ==========================================
// T015: POST /transform — SSE streaming
// ==========================================
aiRoutes.post(
  '/transform',
  requireAuth,
  aiRateLimitMiddleware,
  zValidator('json', aiTransformBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');
    const sessionId = c.get('sessionId') ?? 'dev-session';

    try {
      await assertCanEditBranch(body.branchId, user);

      const { request, stream, conversationId } = await aiService.transform({
        userId: user.id,
        branchId: body.branchId,
        contentId: body.contentId,
        selectedText: body.selectedText,
        instruction: body.instruction,
        conversationId: body.conversationId,
        sessionId,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const provider = providerRegistry.getDefault();

      return streamSSE(c, async (sseStream) => {
        const meta: AIStreamMetaEvent = {
          requestId: request.id,
          conversationId,
          providerId: provider?.id ?? 'unknown',
          modelId: provider?.id ?? 'unknown',
        };
        await sseStream.writeSSE({ data: JSON.stringify(meta), event: 'meta' });

        let fullContent = '';
        let tokensUsed = 0;
        for await (const chunk of stream) {
          if (chunk.type === 'token' && chunk.content) {
            fullContent += chunk.content;
            await sseStream.writeSSE({
              data: JSON.stringify({ content: chunk.content }),
              event: 'token',
            });
          }
          if (chunk.type === 'done') {
            tokensUsed = chunk.metadata?.tokensUsed ?? 0;
          }
          if (chunk.type === 'error') {
            await sseStream.writeSSE({
              data: JSON.stringify({ code: 'PROVIDER_ERROR', message: chunk.error }),
              event: 'error',
            });
            return;
          }
        }

        await sseStream.writeSSE({
          data: JSON.stringify({ requestId: request.id, tokensUsed, fullContent }),
          event: 'done',
        });
      });
    } catch (error) {
      return handleAIError(c, error);
    }
  }
);

// ==========================================
// T016: POST /requests/:requestId/accept
// ==========================================
aiRoutes.post(
  '/requests/:requestId/accept',
  requireAuth,
  zValidator('json', aiAcceptBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { requestId } = c.req.param();
    const body = c.req.valid('json');

    try {
      // Accept the AI request
      const request = await aiService.acceptRequest(requestId, user.id, {
        contentId: body.contentId,
        editedContent: body.editedContent,
        changeDescription: body.changeDescription,
      });

      // Fetch content to build metadataSnapshot for the new version
      const contentRecord = await db.query.contents.findFirst({
        where: eq(schema.contents.id, body.contentId),
      });
      if (!contentRecord) {
        throw new AIServiceError('NOT_FOUND', 'Content not found', 404);
      }

      const metadataSnapshot = createMetadataSnapshot({
        title: contentRecord.title,
        category: contentRecord.category,
        tags: contentRecord.tags ?? [],
      });

      // Create content version with AI attribution (FR-002, FR-003)
      const versionBody = body.editedContent ?? request.generatedContent ?? '';
      const version = await versionService.createVersion(
        body.contentId,
        {
          body: versionBody,
          metadataSnapshot,
          changeDescription: body.changeDescription ?? 'AI-generated content',
          parentVersionId: contentRecord.currentVersionId,
        },
        {
          userId: user.id,
          authorType: 'system',
        }
      );

      // Update content's current version pointer
      await db
        .update(schema.contents)
        .set({
          currentVersionId: version.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.contents.id, body.contentId));

      return c.json({
        success: true,
        contentVersion: version,
        requestId: request.id,
      });
    } catch (error) {
      return handleAIError(c, error);
    }
  }
);

// ==========================================
// T017: POST /requests/:requestId/reject + cancel
// ==========================================
aiRoutes.post(
  '/requests/:requestId/reject',
  requireAuth,
  zValidator('json', aiRejectBodySchema),
  async (c) => {
    const user = c.get('user')!;
    const { requestId } = c.req.param();
    const body = c.req.valid('json');

    try {
      await aiService.rejectRequest(requestId, user.id, body.reason);
      return c.json({ success: true, requestId });
    } catch (error) {
      return handleAIError(c, error);
    }
  }
);

aiRoutes.post('/requests/:requestId/cancel', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { requestId } = c.req.param();

  try {
    await aiService.cancelRequest(requestId, user.id);
    return c.json({ success: true, requestId });
  } catch (error) {
    return handleAIError(c, error);
  }
});

// Force-discard all pending/generating requests for user+branch (reset stuck state)
aiRoutes.post('/discard-pending', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { branchId } = await c.req.json<{ branchId: string }>();

  if (!branchId) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'branchId required' } }, 400);
  }

  const now = new Date();
  const result = await db
    .update(schema.aiRequests)
    .set({ status: 'discarded', resolvedAt: now, resolvedBy: 'system' })
    .where(
      and(
        eq(schema.aiRequests.userId, user.id),
        eq(schema.aiRequests.branchId, branchId),
        inArray(schema.aiRequests.status, ['pending', 'generating'])
      )
    );

  return c.json({ success: true });
});

// ==========================================
// T018: GET /conversation + DELETE /conversation/:conversationId
// ==========================================
aiRoutes.get('/conversation', requireAuth, async (c) => {
  const user = c.get('user')!;
  const branchId = c.req.query('branchId');

  if (!branchId) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'branchId query param required' } }, 400);
  }

  try {
    const conversation = await conversationService.getActive(user.id, branchId);
    if (!conversation) {
      return success(c, { conversation: null });
    }

    return success(c, {
      conversation: {
        id: conversation.id,
        branchId: conversation.branchId,
        status: conversation.status,
        turnCount: conversation.turnCount,
        maxTurns: conversation.maxTurns,
        createdAt: conversation.createdAt.toISOString(),
        requests: conversation.requests.map((r) => ({
          id: r.id,
          requestType: r.requestType,
          prompt: r.prompt,
          generatedContent: r.generatedContent,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleAIError(c, error);
  }
});

aiRoutes.delete('/conversation/:conversationId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { conversationId } = c.req.param();

  try {
    const conversation = await conversationService.getById(conversationId);
    if (!conversation) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
    }
    if (conversation.userId !== user.id) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Not your conversation' } }, 403);
    }

    await conversationService.end(conversationId, 'explicit_clear', user.id);
    return c.json({ success: true });
  } catch (error) {
    return handleAIError(c, error);
  }
});

// ==========================================
// T019: GET /requests/:requestId
// ==========================================
aiRoutes.get('/requests/:requestId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { requestId } = c.req.param();

  try {
    const request = await aiService.getRequestForUser(requestId, user.id);
    return c.json({
      request: {
        id: request.id,
        conversationId: request.conversationId,
        requestType: request.requestType,
        prompt: request.prompt,
        selectedText: request.selectedText,
        generatedContent: request.generatedContent,
        status: request.status,
        providerId: request.providerId,
        modelId: request.modelId,
        tokensUsed: request.tokensUsed,
        createdAt: request.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleAIError(c, error);
  }
});
