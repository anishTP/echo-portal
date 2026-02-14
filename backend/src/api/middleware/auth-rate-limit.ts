import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory sliding window rate limiter for auth endpoints
 * FR-011/012/013: Configurable per-key limits
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxAttempts: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(windowMs: number, maxAttempts: number) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if a key is rate limited. Returns true if allowed, false if blocked.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart > this.windowMs) {
      // New window
      this.store.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetAt: new Date(now + this.windowMs),
      };
    }

    if (entry.count >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.windowStart + this.windowMs),
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxAttempts - entry.count,
      resetAt: new Date(entry.windowStart + this.windowMs),
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > this.windowMs) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Pre-configured rate limiters for auth endpoints
const HOUR_MS = 60 * 60 * 1000;

/** FR-013: 5 signup attempts per hour per IP */
export const signupLimiter = new RateLimiter(HOUR_MS, 5);

/** FR-011: 3 verification resends per hour per email */
export const resendLimiter = new RateLimiter(HOUR_MS, 3);

/** FR-012: 3 password reset requests per hour per email */
export const resetLimiter = new RateLimiter(HOUR_MS, 3);

/**
 * Create Hono middleware that applies rate limiting
 */
export function rateLimit(
  limiter: RateLimiter,
  keyExtractor: (c: Context) => string
) {
  return async (c: Context, next: Next) => {
    const key = keyExtractor(c);
    const result = limiter.check(key);

    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      return c.json(
        {
          success: false,
          error: {
            message: 'Too many requests. Please try again later.',
          },
        },
        429
      );
    }

    await next();
  };
}
