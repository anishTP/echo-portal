/**
 * T100: Tests for permission check performance optimizations (SC-003)
 *
 * Verifies that permission checks meet the <10ms performance target.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hasPermission, canAccessBranch, canEditBranch, type PermissionContext } from '../../src/services/auth/permissions.js';
import { PermissionCache } from '../../src/services/auth/permission-cache.js';
import { permissionMetrics, measurePermissionCheckSync } from '../../src/services/auth/permission-metrics.js';
import { Role } from '@echo-portal/shared';

describe('T100: Permission Check Performance (SC-003)', () => {
  beforeEach(() => {
    permissionMetrics.reset();
  });

  describe('Set-based permission lookups', () => {
    it('hasPermission completes in <1ms (Set lookup)', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      const start = performance.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        hasPermission(context, 'branch:create');
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      // Should be well under 1ms per check with Set lookup
      expect(avgDuration).toBeLessThan(1);
    });

    it('handles multiple roles efficiently', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor', 'reviewer'],
      };

      const start = performance.now();
      hasPermission(context, 'review:approve');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('Request-scoped permission caching', () => {
    let cache: PermissionCache;

    beforeEach(() => {
      cache = new PermissionCache();
    });

    it('caches permission check results', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      // First call - cache miss
      const result1 = cache.hasPermission(context, 'branch:create');
      expect(result1).toBe(true);

      // Second call - cache hit
      const result2 = cache.hasPermission(context, 'branch:create');
      expect(result2).toBe(true);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('cache hit is faster than cache miss', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      // Warm up cache
      cache.hasPermission(context, 'branch:create');

      // Measure cache hit
      const start = performance.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        cache.hasPermission(context, 'branch:create');
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      // Cache hits should be extremely fast (Map lookup)
      expect(avgDuration).toBeLessThan(0.01); // <0.01ms per check
    });

    it('caches canAccessBranch results', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
        resourceOwnerId: 'user1',
        branchVisibility: 'private',
      };

      cache.canAccessBranch(context);
      cache.canAccessBranch(context); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('caches canEditBranch results', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
        resourceOwnerId: 'user1',
        branchState: 'draft',
      };

      cache.canEditBranch(context);
      cache.canEditBranch(context); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('differentiates between different contexts', () => {
      const context1: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      const context2: PermissionContext = {
        userId: 'user2',
        roles: ['reviewer'],
      };

      cache.hasPermission(context1, 'branch:create');
      cache.hasPermission(context2, 'branch:create');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2); // Different contexts = different cache keys
    });

    it('clears cache correctly', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      cache.hasPermission(context, 'branch:create');
      expect(cache.getStats().size).toBe(1);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
    });
  });

  describe('Performance metrics tracking', () => {
    it('records permission check duration', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
      };

      measurePermissionCheckSync('hasPermission', () =>
        hasPermission(context, 'branch:create')
      );

      const stats = permissionMetrics.getStats();
      expect(stats.totalChecks).toBe(1);
      expect(stats.averageDurationMs).toBeGreaterThan(0);
    });

    it('identifies slow checks (>10ms)', () => {
      // Simulate a slow check
      measurePermissionCheckSync('slow-check', () => {
        const start = Date.now();
        while (Date.now() - start < 15) {
          // Busy wait for 15ms
        }
        return true;
      });

      const stats = permissionMetrics.getStats();
      expect(stats.slowCheckCount).toBe(1);
      expect(stats.slowCheckPercentage).toBe(100);
      expect(stats.averageDurationMs).toBeGreaterThan(10);
    });

    it('calculates percentiles correctly', () => {
      // Record various durations
      for (let i = 1; i <= 100; i++) {
        permissionMetrics.record('test', i / 10, false);
      }

      const stats = permissionMetrics.getStats();
      expect(stats.p50).toBeCloseTo(5.0, 0.5);
      expect(stats.p95).toBeCloseTo(9.5, 0.5);
      expect(stats.p99).toBeCloseTo(9.9, 0.5);
    });

    it('detects if performance target is met (SC-003)', () => {
      // All checks under 10ms
      for (let i = 0; i < 100; i++) {
        permissionMetrics.record('fast-check', 5, false);
      }

      expect(permissionMetrics.meetsPerformanceTarget()).toBe(true);
    });

    it('detects if performance target is not met', () => {
      // Many checks over 10ms to ensure p95 exceeds target
      for (let i = 0; i < 90; i++) {
        permissionMetrics.record('fast-check', 5, false);
      }
      for (let i = 0; i < 10; i++) {
        permissionMetrics.record('slow-check', 15, false);
      }

      expect(permissionMetrics.meetsPerformanceTarget()).toBe(false);
    });

    it('resets metrics correctly', () => {
      permissionMetrics.record('test', 5, false);
      expect(permissionMetrics.getStats().totalChecks).toBe(1);

      permissionMetrics.reset();
      expect(permissionMetrics.getStats().totalChecks).toBe(0);
    });
  });

  describe('Real-world performance benchmarks (SC-003)', () => {
    it('hasPermission meets <10ms target', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor', 'reviewer'],
      };

      const durations: number[] = [];

      // Run 100 iterations
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        hasPermission(context, 'branch:create');
        const duration = performance.now() - start;
        durations.push(duration);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(durations.length * 0.95)];

      expect(p95).toBeLessThan(10); // SC-003 requirement
    });

    it('canAccessBranch meets <10ms target', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
        resourceOwnerId: 'user2',
        branchVisibility: 'team',
      };

      const durations: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        canAccessBranch(context);
        const duration = performance.now() - start;
        durations.push(duration);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(durations.length * 0.95)];

      expect(p95).toBeLessThan(10);
    });

    it('canEditBranch meets <10ms target', () => {
      const context: PermissionContext = {
        userId: 'user1',
        roles: ['contributor'],
        resourceOwnerId: 'user1',
        branchState: 'draft',
      };

      const durations: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        canEditBranch(context);
        const duration = performance.now() - start;
        durations.push(duration);
      }

      durations.sort((a, b) => a - b);
      const p95 = durations[Math.floor(durations.length * 0.95)];

      expect(p95).toBeLessThan(10);
    });
  });

  describe('Performance targets documentation', () => {
    it('documents SC-003 requirements', () => {
      const requirements = {
        target: '<10ms per permission check (p95)',
        userFacing: 'Users can determine permissions within 2 seconds of page load',
        implementation: 'Set-based lookups + request-scoped caching',
      };

      expect(requirements.target).toBe('<10ms per permission check (p95)');
      expect(requirements.userFacing).toContain('2 seconds');
    });
  });
});
