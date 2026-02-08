import { db } from '../../db/index.js';
import { aiRequests } from '../../db/schema/ai-requests.js';
import { sql, gt, eq, and } from 'drizzle-orm';
import { AI_DEFAULTS } from '@echo-portal/shared';
import { aiConfigService } from './ai-config-service.js';

/**
 * AIRateLimiter — per-user rate limiting for AI requests (FR-021)
 *
 * Uses AIConfigService for configurable limits with hardcoded fallback.
 */
export class AIRateLimiter {
  private defaultLimit: number = AI_DEFAULTS.RATE_LIMIT_PER_HOUR;

  /**
   * Check if user has remaining quota. Uses configurable limit from AIConfigService.
   */
  async checkLimit(userId: string, role?: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    // Get effective limit from config (falls back to default)
    let limit = this.defaultLimit;
    try {
      const limits = await aiConfigService.getEffectiveLimits(role);
      limit = limits.rateLimit;
    } catch {
      // Use default if config service fails
    }

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
    const remaining = Math.max(0, limit - count);

    // resetAt: when the oldest request in the window expires
    const resetAt = new Date(Date.now() + 60 * 60 * 1000);

    return {
      allowed: count < limit,
      remaining,
      resetAt,
    };
  }

  /**
   * Get remaining quota without checking (for display).
   */
  async getRemainingQuota(userId: string, role?: string): Promise<number> {
    const { remaining } = await this.checkLimit(userId, role);
    return remaining;
  }
}

export const aiRateLimiter = new AIRateLimiter();
