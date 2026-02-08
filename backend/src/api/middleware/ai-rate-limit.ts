import type { Context, Next } from 'hono';
import { aiRateLimiter } from '../../services/ai/rate-limiter.js';

/**
 * AI Rate Limit Middleware (FR-021)
 *
 * Checks per-user AI request quota. Returns 429 with Retry-After
 * header when limit is exceeded.
 */
export async function aiRateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user');
  if (!user?.id) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  const { allowed, remaining, resetAt } = await aiRateLimiter.checkLimit(user.id);

  // Always set rate limit headers
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', resetAt.toISOString());

  if (!allowed) {
    const retryAfterSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfterSeconds));
    return c.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `AI request limit exceeded. Try again after ${resetAt.toISOString()}.`,
        },
      },
      429
    );
  }

  await next();
}
