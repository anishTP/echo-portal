import { db } from '../../db/index.js';
import { aiConversations } from '../../db/schema/ai-conversations.js';
import { aiRequests } from '../../db/schema/ai-requests.js';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { AI_DEFAULTS } from '@echo-portal/shared';
import type { AIConversation } from '../../db/schema/ai-conversations.js';
import type { AIRequest } from '../../db/schema/ai-requests.js';
import { AuditLogger } from '../audit/logger.js';

const auditLogger = new AuditLogger();

/**
 * ConversationService — manages multi-turn AI conversation sessions (FR-015, FR-016)
 *
 * Conversations are scoped to user + branch + session.
 * One active conversation per user per branch (FR-017).
 * Conversation context is cleared on session end or branch switch.
 */
export class ConversationService {
  /**
   * Create a new conversation for user + branch. Ends any existing active
   * conversation for the same user + branch first.
   */
  async create(params: {
    userId: string;
    branchId: string;
    sessionId: string;
    expiresAt: Date;
  }): Promise<AIConversation> {
    // End any existing active conversation for this user+branch (FR-016)
    await this.endByUserAndBranch(params.userId, params.branchId, 'branch_switch');

    const [conversation] = await db
      .insert(aiConversations)
      .values({
        userId: params.userId,
        branchId: params.branchId,
        sessionId: params.sessionId,
        status: 'active',
        turnCount: 0,
        maxTurns: AI_DEFAULTS.MAX_TURNS_PER_CONVERSATION,
        expiresAt: params.expiresAt,
      })
      .returning();

    // Audit: conversation started (G2 remediation)
    await auditLogger.log({
      action: 'ai.conversation_started',
      actorId: params.userId,
      actorType: 'user',
      resourceType: 'content',
      resourceId: conversation.id,
      metadata: { branchId: params.branchId, conversationId: conversation.id },
    });

    return conversation;
  }

  /**
   * Get the active conversation for a user + branch, with its requests.
   */
  async getActive(
    userId: string,
    branchId: string
  ): Promise<(AIConversation & { requests: AIRequest[] }) | null> {
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.userId, userId),
          eq(aiConversations.branchId, branchId),
          eq(aiConversations.status, 'active')
        )
      )
      .limit(1);

    if (conversations.length === 0) return null;

    const conversation = conversations[0];
    const requests = await db
      .select()
      .from(aiRequests)
      .where(eq(aiRequests.conversationId, conversation.id))
      .orderBy(aiRequests.createdAt);

    return { ...conversation, requests };
  }

  /**
   * Get conversation by ID.
   */
  async getById(conversationId: string): Promise<AIConversation | null> {
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    return conversations[0] ?? null;
  }

  /**
   * Increment turn count and update timestamp.
   */
  async addTurn(conversationId: string): Promise<AIConversation> {
    const [updated] = await db
      .update(aiConversations)
      .set({
        turnCount: db.$count(
          aiRequests,
          eq(aiRequests.conversationId, conversationId)
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiConversations.id, conversationId))
      .returning();

    return updated;
  }

  /**
   * Check if conversation has remaining turns.
   */
  async hasRemainingTurns(conversationId: string): Promise<boolean> {
    const conv = await this.getById(conversationId);
    if (!conv) return false;
    return conv.turnCount < conv.maxTurns;
  }

  /**
   * End a conversation with a reason.
   */
  async end(
    conversationId: string,
    endReason: 'session_end' | 'branch_switch' | 'explicit_clear' | 'turn_limit',
    userId?: string
  ): Promise<void> {
    const conv = await this.getById(conversationId);
    if (!conv || conv.status !== 'active') return;

    // Discard any pending requests in this conversation
    await this.discardPendingInConversation(conversationId);

    await db
      .update(aiConversations)
      .set({
        status: 'ended',
        endReason,
        updatedAt: new Date(),
      })
      .where(eq(aiConversations.id, conversationId));

    // Audit: conversation ended (G2 remediation)
    await auditLogger.log({
      action: 'ai.conversation_ended',
      actorId: userId ?? conv.userId,
      actorType: userId ? 'user' : 'system',
      resourceType: 'content',
      resourceId: conversationId,
      metadata: {
        branchId: conv.branchId,
        conversationId,
        endReason,
        turnCount: conv.turnCount,
      },
      initiatingUserId: conv.userId,
    });
  }

  /**
   * End any active conversation for user + branch.
   */
  private async endByUserAndBranch(
    userId: string,
    branchId: string,
    reason: 'branch_switch' | 'session_end'
  ): Promise<void> {
    const active = await this.getActive(userId, branchId);
    if (active) {
      await this.end(active.id, reason, userId);
    }
  }

  /**
   * Discard pending/generating requests within a conversation.
   */
  private async discardPendingInConversation(conversationId: string): Promise<void> {
    const now = new Date();
    await db
      .update(aiRequests)
      .set({
        status: 'discarded',
        resolvedAt: now,
        resolvedBy: 'system',
      })
      .where(
        and(
          eq(aiRequests.conversationId, conversationId),
          inArray(aiRequests.status, ['pending', 'generating'])
        )
      );
  }

  /**
   * Cleanup expired conversations and their pending requests.
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();

    // Find expired active conversations
    const expired = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.status, 'active'),
          lt(aiConversations.expiresAt, now)
        )
      );

    for (const conv of expired) {
      await this.end(conv.id, 'session_end');
    }

    return expired.length;
  }

  /**
   * Discard all pending content for a session (called on session end) (FR-012).
   */
  async discardBySession(sessionId: string): Promise<void> {
    const conversations = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.sessionId, sessionId),
          eq(aiConversations.status, 'active')
        )
      );

    for (const conv of conversations) {
      await this.end(conv.id, 'session_end');
    }
  }
}

export const conversationService = new ConversationService();
