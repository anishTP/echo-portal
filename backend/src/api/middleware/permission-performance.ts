/**
 * T100: Permission performance middleware
 *
 * - Initializes request-scoped permission cache
 * - Measures permission check performance
 * - Reports metrics for monitoring
 */

import type { Context, Next } from 'hono';
import { PermissionCache, PERMISSION_CACHE_KEY } from '../../services/auth/permission-cache.js';

/**
 * Middleware to set up request-scoped permission caching (T100)
 *
 * Creates a permission cache for each request and attaches it to context.
 * Cache is automatically cleared at the end of the request.
 */
export async function permissionCacheMiddleware(c: Context, next: Next) {
  // Initialize request-scoped permission cache
  const cache = new PermissionCache();
  c.set(PERMISSION_CACHE_KEY, cache);

  try {
    await next();
  } finally {
    // Log cache stats for monitoring (optional, can be removed in production)
    const stats = cache.getStats();
    if (stats.hits + stats.misses > 0) {
      c.req.header('X-Permission-Cache-Hits', stats.hits.toString());
      c.req.header('X-Permission-Cache-Misses', stats.misses.toString());
      c.req.header('X-Permission-Cache-Hit-Rate', (stats.hitRate * 100).toFixed(1));
    }

    // Clear cache
    cache.clear();
  }
}

/**
 * Get permission cache from context
 */
export function getPermissionCache(c: Context): PermissionCache | undefined {
  return c.get(PERMISSION_CACHE_KEY);
}
