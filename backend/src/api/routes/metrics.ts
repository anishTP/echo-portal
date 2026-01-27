/**
 * T100: Metrics API routes
 *
 * Provides performance metrics for monitoring permission checks
 * and other system performance indicators.
 */

import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { permissionMetrics } from '../../services/auth/permission-metrics.js';
import { success } from '../utils/responses.js';
import { PermissionDenials } from '../utils/errors.js';

const metricsRoutes = new Hono<AuthEnv>();

/**
 * GET /api/v1/metrics/permissions - Permission check performance metrics
 * Admin only - SC-003 monitoring
 */
metricsRoutes.get('/permissions', requireAuth, async (c) => {
  const user = c.get('user')!;

  // Only administrators can view metrics
  if (!user.roles.includes('administrator')) {
    throw PermissionDenials.insufficientRole(
      user.role,
      'administrator',
      'view performance metrics'
    );
  }

  const stats = permissionMetrics.getStats();
  const recentMetrics = permissionMetrics.getRecentMetrics(50);

  return success(c, {
    stats: {
      totalChecks: stats.totalChecks,
      averageDurationMs: Number(stats.averageDurationMs.toFixed(3)),
      p50DurationMs: Number(stats.p50.toFixed(3)),
      p95DurationMs: Number(stats.p95.toFixed(3)),
      p99DurationMs: Number(stats.p99.toFixed(3)),
      slowCheckCount: stats.slowCheckCount,
      slowCheckPercentage: Number(stats.slowCheckPercentage.toFixed(2)),
      meetsTarget: permissionMetrics.meetsPerformanceTarget(), // SC-003: <10ms
    },
    recentChecks: recentMetrics.map((m) => ({
      operation: m.operation,
      durationMs: Number(m.durationMs.toFixed(3)),
      cacheHit: m.cacheHit,
      timestamp: new Date(m.timestamp).toISOString(),
    })),
    targets: {
      p95Target: 10, // SC-003 requirement
      description: 'Permission checks should complete in <10ms (95th percentile)',
    },
  });
});

/**
 * POST /api/v1/metrics/permissions/reset - Reset permission metrics
 * Admin only - for testing/troubleshooting
 */
metricsRoutes.post('/permissions/reset', requireAuth, async (c) => {
  const user = c.get('user')!;

  // Only administrators can reset metrics
  if (!user.roles.includes('administrator')) {
    throw PermissionDenials.insufficientRole(
      user.role,
      'administrator',
      'reset performance metrics'
    );
  }

  permissionMetrics.reset();

  return success(c, {
    message: 'Permission metrics reset successfully',
  });
});

export default metricsRoutes;
