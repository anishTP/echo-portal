/**
 * T100: Request-scoped permission caching for performance optimization
 *
 * Provides request-level caching for permission checks to avoid redundant
 * computations within a single HTTP request. Meets SC-003 requirement
 * of <10ms permission checks.
 */

import type { PermissionContext, Permission } from './permissions.js';
import { hasPermission, canAccessBranch, canEditBranch } from './permissions.js';

interface PermissionCacheEntry {
  result: boolean;
  timestamp: number;
}

/**
 * Request-scoped permission cache
 * Cleared automatically at end of request
 */
export class PermissionCache {
  private cache: Map<string, PermissionCacheEntry> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * Generate cache key from context and permission
   */
  private getCacheKey(context: PermissionContext, permission: Permission): string {
    return `${context.userId}:${context.roles.join(',')}:${permission}:${context.resourceOwnerId || ''}:${context.branchState || ''}`;
  }

  /**
   * Check permission with caching
   */
  hasPermission(context: PermissionContext, permission: Permission): boolean {
    const key = this.getCacheKey(context, permission);
    const cached = this.cache.get(key);

    if (cached) {
      this.hits++;
      return cached.result;
    }

    this.misses++;
    const result = hasPermission(context, permission);
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }

  /**
   * Check branch access with caching
   */
  canAccessBranch(context: PermissionContext): boolean {
    const key = `access:${context.userId}:${context.resourceOwnerId}:${context.branchVisibility}`;
    const cached = this.cache.get(key);

    if (cached) {
      this.hits++;
      return cached.result;
    }

    this.misses++;
    const result = canAccessBranch(context);
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }

  /**
   * Check branch edit with caching
   */
  canEditBranch(context: PermissionContext): boolean {
    const key = `edit:${context.userId}:${context.resourceOwnerId}:${context.branchState}`;
    const cached = this.cache.get(key);

    if (cached) {
      this.hits++;
      return cached.result;
    }

    this.misses++;
    const result = canEditBranch(context);
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
    };
  }

  /**
   * Clear cache (called at end of request)
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Hono context variable key for permission cache
 */
export const PERMISSION_CACHE_KEY = 'permissionCache';
