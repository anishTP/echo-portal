import { db } from '../../db/index.js';
import { aiRequests } from '../../db/schema/ai-requests.js';
import { eq, and, inArray, lt } from 'drizzle-orm';
import { AI_DEFAULTS } from '@echo-portal/shared';
import type { AIRequest } from '../../db/schema/ai-requests.js';
import type { AIStreamChunk, ConversationTurn } from './provider-interface.js';
import { providerRegistry } from './provider-registry.js';
import { conversationService } from './conversation-service.js';
import { aiRateLimiter } from './rate-limiter.js';
import { aiConfigService } from './ai-config-service.js';
import { aiContextDocumentService } from './ai-context-service.js';
import { AuditLogger } from '../audit/logger.js';

const auditLogger = new AuditLogger();

export interface GenerateInput {
  userId: string;
  branchId: string;
  contentId?: string;
  prompt: string;
  conversationId?: string;
  context?: string;
  mode?: string;
  selectedText?: string;
  cursorContext?: string;
  images?: Array<{ mediaType: string; data: string }>;
  sessionId: string;
  sessionExpiresAt: Date;
}

export interface TransformInput {
  userId: string;
  branchId: string;
  contentId: string;
  selectedText: string;
  instruction: string;
  conversationId?: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

/**
 * Core AIService — orchestrates AI generation workflow (FR-001 through FR-021)
 *
 * Flow: validate → check limits → ensure conversation → create request →
 * stream from provider → update request → audit log
 */
export class AIService {
  /**
   * Start an AI generation request. Returns async iterable of stream chunks
   * and the created request record.
   */
  async generate(input: GenerateInput & { userRole?: string }): Promise<{
    request: AIRequest;
    stream: AsyncIterable<AIStreamChunk>;
    conversationId: string;
  }> {
    // Check if AI is enabled (FR-010)
    const enabled = await aiConfigService.isEnabled(input.userRole);
    if (!enabled) {
      throw new AIServiceError('AI_DISABLED', 'AI assistance is currently disabled', 403);
    }

    // Check rate limit (FR-021)
    const rateCheck = await aiRateLimiter.checkLimit(input.userId, input.userRole);
    if (!rateCheck.allowed) {
      throw new AIServiceError('RATE_LIMIT_EXCEEDED', 'AI request limit exceeded', 429);
    }

    // Check single-pending constraint (FR-017)
    await this.ensureNoPending(input.userId, input.branchId);

    // Get or create conversation (FR-015)
    const conversation = input.conversationId
      ? await this.getAndValidateConversation(input.conversationId, input.userId, input.branchId)
      : await conversationService.create({
          userId: input.userId,
          branchId: input.branchId,
          sessionId: input.sessionId,
          expiresAt: input.sessionExpiresAt,
        });

    // Get provider
    const provider = providerRegistry.getDefault();
    if (!provider) {
      throw new AIServiceError('PROVIDER_UNAVAILABLE', 'No AI provider configured', 503);
    }

    // Create request record (FR-018)
    const [request] = await db
      .insert(aiRequests)
      .values({
        conversationId: conversation.id,
        userId: input.userId,
        branchId: input.branchId,
        contentId: input.contentId ?? null,
        requestType: 'generation',
        prompt: input.prompt,
        selectedText: input.selectedText ?? null,
        responseMode: input.mode ?? 'add',
        status: 'generating',
        providerId: provider.id,
        modelId: null, // Set on completion from provider metadata
        expiresAt: input.sessionExpiresAt,
      })
      .returning();

    // Audit: request started
    await auditLogger.log({
      action: 'ai.requested',
      actorId: input.userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: request.id,
      metadata: {
        requestType: 'generation',
        conversationId: conversation.id,
        branchId: input.branchId,
        providerId: provider.id,
      },
    });

    // Build conversation history for context
    const history = await this.buildConversationHistory(conversation.id);

    // Get effective token limit from config
    const limits = await aiConfigService.getEffectiveLimits(input.userRole);

    // Fetch enabled context documents for system prompt injection
    const enabledDocs = await aiContextDocumentService.getEnabled();
    const contextDocuments = enabledDocs.map((d) => ({ title: d.title, content: d.content }));

    // Warn if context docs are very large (>50k chars total)
    const totalChars = contextDocuments.reduce((sum, d) => sum + d.content.length, 0);
    if (totalChars > 50_000) {
      console.warn(`[AI] Context documents total ${totalChars} chars (~${Math.round(totalChars / 4)}tokens). Consider reducing.`);
    }

    // Create the provider stream
    const providerStream = provider.generate({
      prompt: input.prompt,
      context: input.context,
      mode: input.mode,
      conversationHistory: history,
      maxTokens: limits.maxTokens,
      selectedText: input.selectedText,
      cursorContext: input.cursorContext,
      contextDocuments: contextDocuments.length > 0 ? contextDocuments : undefined,
      images: input.images,
    });

    // Wrap stream to capture completion and update DB
    const wrappedStream = this.wrapStream(providerStream, request.id, conversation.id, input.userId);

    return {
      request,
      stream: wrappedStream,
      conversationId: conversation.id,
    };
  }

  /**
   * Start an AI transformation request.
   */
  async transform(input: TransformInput & { userRole?: string }): Promise<{
    request: AIRequest;
    stream: AsyncIterable<AIStreamChunk>;
    conversationId: string;
  }> {
    // Check if AI is enabled (FR-010)
    const enabled = await aiConfigService.isEnabled(input.userRole);
    if (!enabled) {
      throw new AIServiceError('AI_DISABLED', 'AI assistance is currently disabled', 403);
    }

    // Check rate limit (FR-021)
    const rateCheck = await aiRateLimiter.checkLimit(input.userId, input.userRole);
    if (!rateCheck.allowed) {
      throw new AIServiceError('RATE_LIMIT_EXCEEDED', 'AI request limit exceeded', 429);
    }

    // Check single-pending constraint (FR-017)
    await this.ensureNoPending(input.userId, input.branchId);

    // Get or create conversation (FR-015)
    const conversation = input.conversationId
      ? await this.getAndValidateConversation(input.conversationId, input.userId, input.branchId)
      : await conversationService.create({
          userId: input.userId,
          branchId: input.branchId,
          sessionId: input.sessionId,
          expiresAt: input.sessionExpiresAt,
        });

    const provider = providerRegistry.getDefault();
    if (!provider) {
      throw new AIServiceError('PROVIDER_UNAVAILABLE', 'No AI provider configured', 503);
    }

    const [request] = await db
      .insert(aiRequests)
      .values({
        conversationId: conversation.id,
        userId: input.userId,
        branchId: input.branchId,
        contentId: input.contentId,
        requestType: 'transformation',
        prompt: input.instruction,
        selectedText: input.selectedText,
        responseMode: 'replace',
        status: 'generating',
        providerId: provider.id,
        modelId: null,
        expiresAt: input.sessionExpiresAt,
      })
      .returning();

    await auditLogger.log({
      action: 'ai.requested',
      actorId: input.userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: request.id,
      metadata: {
        requestType: 'transformation',
        conversationId: conversation.id,
        branchId: input.branchId,
        providerId: provider.id,
      },
    });

    // Get effective token limit from config
    const limits = await aiConfigService.getEffectiveLimits(input.userRole);

    const providerStream = provider.transform({
      selectedText: input.selectedText,
      instruction: input.instruction,
      maxTokens: limits.maxTokens,
    });

    const wrappedStream = this.wrapStream(providerStream, request.id, conversation.id, input.userId);

    return {
      request,
      stream: wrappedStream,
      conversationId: conversation.id,
    };
  }

  /**
   * Accept pending AI content → create content version (FR-003)
   */
  async acceptRequest(
    requestId: string,
    userId: string,
    params: { contentId: string; editedContent?: string; changeDescription?: string }
  ): Promise<AIRequest> {
    const request = await this.getRequestForUser(requestId, userId);
    if (request.status !== 'pending') {
      throw new AIServiceError('INVALID_STATE', `Request is '${request.status}', expected 'pending'`, 409);
    }

    const now = new Date();
    const [updated] = await db
      .update(aiRequests)
      .set({
        status: 'accepted',
        resolvedAt: now,
        resolvedBy: 'user',
      })
      .where(eq(aiRequests.id, requestId))
      .returning();

    // Audit: content accepted
    await auditLogger.log({
      action: 'ai.accepted',
      actorId: userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: requestId,
      metadata: {
        conversationId: request.conversationId,
        contentId: params.contentId,
        providerId: request.providerId,
        modelId: request.modelId,
      },
      initiatingUserId: userId,
    });

    return updated;
  }

  /**
   * Reject pending AI content (FR-003)
   */
  async rejectRequest(requestId: string, userId: string, reason?: string): Promise<AIRequest> {
    const request = await this.getRequestForUser(requestId, userId);
    if (request.status !== 'pending') {
      throw new AIServiceError('INVALID_STATE', `Request is '${request.status}', expected 'pending'`, 409);
    }

    const [updated] = await db
      .update(aiRequests)
      .set({
        status: 'rejected',
        resolvedAt: new Date(),
        resolvedBy: 'user',
      })
      .where(eq(aiRequests.id, requestId))
      .returning();

    await auditLogger.log({
      action: 'ai.rejected',
      actorId: userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: requestId,
      metadata: {
        conversationId: request.conversationId,
        reason,
      },
    });

    return updated;
  }

  /**
   * Cancel an in-progress generating request (FR-019)
   */
  async cancelRequest(requestId: string, userId: string): Promise<AIRequest> {
    const request = await this.getRequestForUser(requestId, userId);
    if (request.status !== 'generating') {
      throw new AIServiceError('INVALID_STATE', `Request is '${request.status}', expected 'generating'`, 409);
    }

    const [updated] = await db
      .update(aiRequests)
      .set({
        status: 'cancelled',
        generatedContent: null, // Discard partial content
        resolvedAt: new Date(),
        resolvedBy: 'user',
      })
      .where(eq(aiRequests.id, requestId))
      .returning();

    await auditLogger.log({
      action: 'ai.cancelled',
      actorId: userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: requestId,
      metadata: { conversationId: request.conversationId },
    });

    return updated;
  }

  /**
   * Get a specific request, verifying ownership.
   */
  async getRequestForUser(requestId: string, userId: string): Promise<AIRequest> {
    const results = await db
      .select()
      .from(aiRequests)
      .where(eq(aiRequests.id, requestId))
      .limit(1);

    const request = results[0];
    if (!request) {
      throw new AIServiceError('NOT_FOUND', 'AI request not found', 404);
    }
    if (request.userId !== userId) {
      throw new AIServiceError('FORBIDDEN', 'Request belongs to another user', 403);
    }

    return request;
  }

  // --- Private helpers ---

  private async ensureNoPending(userId: string, branchId: string): Promise<void> {
    // Auto-discard stale pending/generating requests (older than 30 min or expired)
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 30 * 60 * 1000);
    await db
      .update(aiRequests)
      .set({ status: 'discarded', resolvedAt: now, resolvedBy: 'system' })
      .where(
        and(
          eq(aiRequests.userId, userId),
          eq(aiRequests.branchId, branchId),
          inArray(aiRequests.status, ['pending', 'generating']),
          lt(aiRequests.createdAt, staleThreshold)
        )
      );

    const pending = await db
      .select({ id: aiRequests.id })
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.userId, userId),
          eq(aiRequests.branchId, branchId),
          inArray(aiRequests.status, ['pending', 'generating'])
        )
      )
      .limit(1);

    if (pending.length > 0) {
      throw new AIServiceError(
        'PENDING_REQUEST_EXISTS',
        'Resolve your current pending AI request before making a new one',
        409
      );
    }
  }

  private async getAndValidateConversation(
    conversationId: string,
    userId: string,
    branchId: string
  ) {
    const conversation = await conversationService.getById(conversationId);
    if (!conversation) {
      throw new AIServiceError('NOT_FOUND', 'Conversation not found', 404);
    }
    if (conversation.userId !== userId) {
      throw new AIServiceError('FORBIDDEN', 'Conversation belongs to another user', 403);
    }
    if (conversation.branchId !== branchId) {
      throw new AIServiceError('INVALID_STATE', 'Conversation belongs to a different branch', 409);
    }
    if (conversation.status !== 'active') {
      throw new AIServiceError('INVALID_STATE', 'Conversation has ended', 409);
    }
    if (conversation.turnCount >= conversation.maxTurns) {
      throw new AIServiceError('TURN_LIMIT_REACHED', 'Conversation turn limit reached. Start a new conversation.', 409);
    }
    return conversation;
  }

  private async buildConversationHistory(conversationId: string): Promise<ConversationTurn[]> {
    const requests = await db
      .select()
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.conversationId, conversationId),
          inArray(aiRequests.status, ['pending', 'accepted', 'rejected'])
        )
      )
      .orderBy(aiRequests.createdAt);

    const history: ConversationTurn[] = [];
    for (const req of requests) {
      // Include selected text context in history so the LLM knows what each
      // turn was referring to (avoids confusion in multi-turn conversations).
      const userContent = req.selectedText
        ? `[Selected text: ${req.selectedText}]\n\n${req.prompt}`
        : req.prompt;
      history.push({ role: 'user', content: userContent });
      if (req.generatedContent) {
        history.push({ role: 'assistant', content: req.generatedContent });
      }
    }
    return history;
  }

  /**
   * Wrap the provider stream to capture completion/errors and update the DB.
   */
  private async *wrapStream(
    stream: AsyncIterable<AIStreamChunk>,
    requestId: string,
    conversationId: string,
    userId: string
  ): AsyncIterable<AIStreamChunk> {
    let fullContent = '';
    let tokensUsed = 0;
    let modelId: string | null = null;

    try {
      for await (const chunk of stream) {
        if (chunk.type === 'token' && chunk.content) {
          fullContent += chunk.content;
        }

        if (chunk.type === 'done' && chunk.metadata) {
          tokensUsed = chunk.metadata.tokensUsed ?? 0;
          modelId = chunk.metadata.model ?? null;
        }

        if (chunk.type === 'error') {
          // Update request to error state
          await db
            .update(aiRequests)
            .set({
              status: 'cancelled',
              errorMessage: chunk.error ?? 'Provider error',
              resolvedAt: new Date(),
              resolvedBy: 'system',
            })
            .where(eq(aiRequests.id, requestId));
        }

        yield chunk;
      }

      // Stream completed successfully — update request to pending
      await db
        .update(aiRequests)
        .set({
          status: 'pending',
          generatedContent: fullContent,
          tokensUsed,
          modelId,
        })
        .where(eq(aiRequests.id, requestId));

      // Increment conversation turn count
      await conversationService.addTurn(conversationId);

      // Audit: content generated
      await auditLogger.log({
        action: 'ai.generated',
        actorId: userId,
        actorType: 'system',
        resourceType: 'content',
        resourceId: requestId,
        metadata: {
          conversationId,
          tokensUsed,
          modelId,
        },
        initiatingUserId: userId,
      });
    } catch (error) {
      // Provider failure — update request
      await db
        .update(aiRequests)
        .set({
          status: 'cancelled',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          resolvedAt: new Date(),
          resolvedBy: 'system',
        })
        .where(eq(aiRequests.id, requestId));

      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Provider error',
      };
    }
  }
}

export class AIServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export const aiService = new AIService();
