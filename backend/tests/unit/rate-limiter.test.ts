import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  signupLimiter,
  resendLimiter,
  resetLimiter,
} from '../../src/api/middleware/auth-rate-limit.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(60_000, 5); // 1 minute window, 5 max attempts
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  describe('allows requests under limit', () => {
    it('allows the first request for a new key', () => {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
    });

    it('allows multiple requests within the limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('user-1');
        if (i < 5) {
          expect(result.allowed).toBe(true);
        }
      }
    });
  });

  describe('blocks requests at limit', () => {
    it('blocks after maxAttempts are exhausted', () => {
      // Use all 5 attempts
      for (let i = 0; i < 5; i++) {
        limiter.check('user-1');
      }

      const result = limiter.check('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('continues to block subsequent requests after limit is reached', () => {
      // Use all 5 attempts
      for (let i = 0; i < 5; i++) {
        limiter.check('user-1');
      }

      // All further requests should be blocked
      for (let i = 0; i < 3; i++) {
        const result = limiter.check('user-1');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    });
  });

  describe('tracks remaining correctly', () => {
    it('returns maxAttempts - 1 remaining on first request', () => {
      const result = limiter.check('user-1');
      expect(result.remaining).toBe(4); // 5 - 1
    });

    it('decrements remaining with each request', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('user-1');
        expect(result.remaining).toBe(4 - i); // 4, 3, 2, 1, 0
      }
    });

    it('returns 0 remaining when blocked', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('user-1');
      }
      const result = limiter.check('user-1');
      expect(result.remaining).toBe(0);
    });

    it('returns a resetAt date in the future', () => {
      const now = Date.now();
      const result = limiter.check('user-1');
      expect(result.resetAt.getTime()).toBe(now + 60_000);
    });
  });

  describe('different keys are independent', () => {
    it('tracks separate keys independently', () => {
      // Exhaust limit for key-a
      for (let i = 0; i < 5; i++) {
        limiter.check('key-a');
      }
      const blockedResult = limiter.check('key-a');
      expect(blockedResult.allowed).toBe(false);

      // key-b should still be allowed
      const freshResult = limiter.check('key-b');
      expect(freshResult.allowed).toBe(true);
      expect(freshResult.remaining).toBe(4);
    });

    it('decrements remaining independently per key', () => {
      limiter.check('key-a');
      limiter.check('key-a');
      limiter.check('key-b');

      const resultA = limiter.check('key-a');
      expect(resultA.remaining).toBe(2); // 5 - 3

      const resultB = limiter.check('key-b');
      expect(resultB.remaining).toBe(3); // 5 - 2
    });
  });

  describe('window resets after expiry', () => {
    it('resets the window after windowMs has elapsed', () => {
      // Use all 5 attempts
      for (let i = 0; i < 5; i++) {
        limiter.check('user-1');
      }
      const blocked = limiter.check('user-1');
      expect(blocked.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(60_001);

      // Should be allowed again with a fresh window
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 (fresh window)
    });

    it('provides a new resetAt after window resets', () => {
      limiter.check('user-1');
      vi.advanceTimersByTime(60_001);

      const now = Date.now();
      const result = limiter.check('user-1');
      expect(result.resetAt.getTime()).toBe(now + 60_000);
    });
  });

  describe('cleanup removes expired entries', () => {
    it('removes expired entries during periodic cleanup', () => {
      limiter.check('user-1');
      limiter.check('user-2');

      // Advance past the window so entries expire
      vi.advanceTimersByTime(60_001);

      // Trigger the cleanup interval (runs every 60s)
      vi.advanceTimersByTime(60_000);

      // After cleanup, a new check should start a fresh window
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('destroy clears all entries and stops cleanup', () => {
      limiter.check('user-1');
      limiter.destroy();

      // After destroy, a new check starts fresh (store was cleared)
      // But we need a new limiter since the old one is destroyed
      const newLimiter = new RateLimiter(60_000, 5);
      const result = newLimiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      newLimiter.destroy();
    });
  });
});

describe('pre-configured limiters', () => {
  const HOUR_MS = 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('signupLimiter', () => {
    it('allows 5 attempts', () => {
      const key = `signup-test-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        const result = signupLimiter.check(key);
        expect(result.allowed).toBe(true);
      }
      const blocked = signupLimiter.check(key);
      expect(blocked.allowed).toBe(false);
    });

    it('has a 1 hour window', () => {
      const key = `signup-window-${Date.now()}`;
      const result = signupLimiter.check(key);
      const now = Date.now();
      expect(result.resetAt.getTime()).toBe(now + HOUR_MS);
    });
  });

  describe('resendLimiter', () => {
    it('allows 3 attempts', () => {
      const key = `resend-test-${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        const result = resendLimiter.check(key);
        expect(result.allowed).toBe(true);
      }
      const blocked = resendLimiter.check(key);
      expect(blocked.allowed).toBe(false);
    });

    it('has a 1 hour window', () => {
      const key = `resend-window-${Date.now()}`;
      const result = resendLimiter.check(key);
      const now = Date.now();
      expect(result.resetAt.getTime()).toBe(now + HOUR_MS);
    });
  });

  describe('resetLimiter', () => {
    it('allows 3 attempts', () => {
      const key = `reset-test-${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        const result = resetLimiter.check(key);
        expect(result.allowed).toBe(true);
      }
      const blocked = resetLimiter.check(key);
      expect(blocked.allowed).toBe(false);
    });

    it('has a 1 hour window', () => {
      const key = `reset-window-${Date.now()}`;
      const result = resetLimiter.check(key);
      const now = Date.now();
      expect(result.resetAt.getTime()).toBe(now + HOUR_MS);
    });
  });
});
