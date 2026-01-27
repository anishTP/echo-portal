/**
 * T100: Performance monitoring for permission checks (SC-003)
 *
 * Tracks permission check latency to ensure <10ms target is met.
 * Provides metrics for monitoring and alerting.
 */

interface PermissionCheckMetric {
  operation: string;
  durationMs: number;
  timestamp: number;
  cacheHit: boolean;
}

class PermissionMetrics {
  private metrics: PermissionCheckMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 checks
  private totalChecks = 0;
  private totalDuration = 0;
  private slowChecks = 0; // Checks > 10ms

  /**
   * Record a permission check
   */
  record(operation: string, durationMs: number, cacheHit: boolean = false) {
    this.totalChecks++;
    this.totalDuration += durationMs;

    if (durationMs > 10) {
      this.slowChecks++;
      // Log slow permission checks for investigation
      console.warn(`[T100] Slow permission check: ${operation} took ${durationMs.toFixed(2)}ms`);
    }

    this.metrics.push({
      operation,
      durationMs,
      timestamp: Date.now(),
      cacheHit,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    if (this.totalChecks === 0) {
      return {
        totalChecks: 0,
        averageDurationMs: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        slowCheckCount: 0,
        slowCheckPercentage: 0,
      };
    }

    const durations = this.metrics
      .map((m) => m.durationMs)
      .sort((a, b) => a - b);

    return {
      totalChecks: this.totalChecks,
      averageDurationMs: this.totalDuration / this.totalChecks,
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      slowCheckCount: this.slowChecks,
      slowCheckPercentage: (this.slowChecks / this.totalChecks) * 100,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 100) {
    return this.metrics.slice(-count);
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = [];
    this.totalChecks = 0;
    this.totalDuration = 0;
    this.slowChecks = 0;
  }

  /**
   * Check if performance target is met (SC-003: <10ms)
   */
  meetsPerformanceTarget(): boolean {
    const stats = this.getStats();
    return stats.p95 < 10; // 95th percentile should be under 10ms
  }
}

// Global singleton
export const permissionMetrics = new PermissionMetrics();

/**
 * Measure permission check performance
 */
export async function measurePermissionCheck<T>(
  operation: string,
  fn: () => T | Promise<T>,
  cacheHit: boolean = false
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    permissionMetrics.record(operation, duration, cacheHit);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    permissionMetrics.record(`${operation}:error`, duration, cacheHit);
    throw error;
  }
}

/**
 * Synchronous version for pure function measurements
 */
export function measurePermissionCheckSync<T>(
  operation: string,
  fn: () => T,
  cacheHit: boolean = false
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    permissionMetrics.record(operation, duration, cacheHit);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    permissionMetrics.record(`${operation}:error`, duration, cacheHit);
    throw error;
  }
}
