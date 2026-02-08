import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIRateLimiter } from '../../src/services/ai/rate-limiter';

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../../src/db/schema/ai-requests', () => ({
  aiRequests: {
    userId: 'userId',
    createdAt: 'createdAt',
  },
}));

vi.mock('../../src/db/schema/ai-configurations', () => ({
  aiConfigurations: {
    id: 'id',
    scope: 'scope',
    key: 'key',
    value: 'value',
    updatedBy: 'updatedBy',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  },
}));

// Mock config service
vi.mock('../../src/services/ai/ai-config-service', () => ({
  aiConfigService: {
    getEffectiveLimits: vi.fn().mockResolvedValue({
      maxTokens: 4000,
      rateLimit: 50,
      maxTurns: 20,
    }),
  },
}));

import { db } from '../../src/db';

describe('AIRateLimiter', () => {
  let limiter: AIRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    limiter = new AIRateLimiter();
  });

  describe('checkLimit()', () => {
    it('allows request when under the limit', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const result = await limiter.checkLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40);
    });

    it('denies request when at the limit', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 50 }]),
        }),
      });

      const result = await limiter.checkLimit('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('denies request when over the limit', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 55 }]),
        }),
      });

      const result = await limiter.checkLimit('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('returns a resetAt timestamp in the future', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const result = await limiter.checkLimit('user-1');
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('handles null count gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: null }]),
        }),
      });

      // null should be treated as 0 (no requests)
      const result = await limiter.checkLimit('user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRemainingQuota()', () => {
    it('returns remaining count', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 30 }]),
        }),
      });

      const remaining = await limiter.getRemainingQuota('user-1');
      expect(remaining).toBe(20);
    });
  });
});
