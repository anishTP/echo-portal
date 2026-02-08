import { db } from '../../db/index.js';
import { aiRequests } from '../../db/schema/ai-requests.js';
import { sql, gt, eq, and } from 'drizzle-orm';
import { AI_DEFAULTS } from '@echo-portal/shared';

/**
 * AIRateLimiter — per-user rate limiting for AI requests (FR-021)
 *
 * Phase 1: hardcoded 50 requests/user/hour using sliding window.
 * Phase 2: limit becomes configurable via AIConfigService.
 */
export class AIRateLimiter {
  private limit = AI_DEFAULTS.RATE_LIMIT_PER_HOUR;

  /**
   * Check if user has remaining quota. Returns { allowed, remaining, resetAt }.
   */
  async checkLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.userId, userId),
          gt(aiRequests.createdAt, oneHourAgo)
        )
      );

    const count = result?.count ?? 0;
    const remaining = Math.max(0, this.limit - count);

    // resetAt: when the oldest request in the window expires
    const resetAt = new Date(Date.now() + 60 * 60 * 1000);

    return {
      allowed: count < this.limit,
      remaining,
      resetAt,
    };
  }

  /**
   * Get remaining quota without checking (for display).
   */
  async getRemainingQuota(userId: string): Promise<number> {
    const { remaining } = await this.checkLimit(userId);
    return remaining;
  }

  /** Update the limit (Phase 2: called by AIConfigService) */
  setLimit(newLimit: number): void {
    this.limit = newLimit;
  }
}

export const aiRateLimiter = new AIRateLimiter();
