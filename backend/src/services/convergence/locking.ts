import { db } from '../../db/index.js';
import { convergenceOperations } from '../../db/schema/convergence.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { ConvergenceStatus } from '@echo-portal/shared';

/**
 * Lock acquisition result
 */
export interface LockResult {
  acquired: boolean;
  lockId?: string;
  reason?: string;
  blockedBy?: string;
}

/**
 * Service for managing convergence locks (first-wins blocking)
 * Ensures only one convergence operation can run at a time for a given target
 */
export class LockingService {
  /**
   * Attempt to acquire a lock for convergence
   * Uses database-level locking to ensure atomicity
   */
  async acquireLock(
    branchId: string,
    targetRef: string,
    convergenceId: string
  ): Promise<LockResult> {
    // Check if there's an active convergence operation for the same target
    const activeOperations = await db.query.convergenceOperations.findMany({
      where: and(
        eq(convergenceOperations.targetRef, targetRef),
        inArray(convergenceOperations.status, [
          ConvergenceStatus.VALIDATING,
          ConvergenceStatus.MERGING,
        ])
      ),
    });

    if (activeOperations.length > 0) {
      const blocker = activeOperations[0];
      return {
        acquired: false,
        reason: `Another convergence operation is in progress for ${targetRef}`,
        blockedBy: blocker.id,
      };
    }

    // Check if there's a pending operation that was created before this one
    const pendingOperations = await db.query.convergenceOperations.findMany({
      where: and(
        eq(convergenceOperations.targetRef, targetRef),
        eq(convergenceOperations.status, ConvergenceStatus.PENDING),
        sql`${convergenceOperations.createdAt} < (SELECT created_at FROM convergence_operations WHERE id = ${convergenceId})`
      ),
    });

    if (pendingOperations.length > 0) {
      const blocker = pendingOperations[0];
      return {
        acquired: false,
        reason: 'Another convergence operation is queued ahead of this one',
        blockedBy: blocker.id,
      };
    }

    // Acquire the lock by updating status to validating
    await db
      .update(convergenceOperations)
      .set({
        status: ConvergenceStatus.VALIDATING,
        startedAt: new Date(),
      })
      .where(eq(convergenceOperations.id, convergenceId));

    return {
      acquired: true,
      lockId: convergenceId,
    };
  }

  /**
   * Release a lock (mark operation as complete or failed)
   */
  async releaseLock(
    convergenceId: string,
    status: 'succeeded' | 'failed' | 'rolled_back'
  ): Promise<void> {
    const statusMap = {
      succeeded: ConvergenceStatus.SUCCEEDED,
      failed: ConvergenceStatus.FAILED,
      rolled_back: ConvergenceStatus.ROLLED_BACK,
    };

    await db
      .update(convergenceOperations)
      .set({
        status: statusMap[status],
        completedAt: new Date(),
      })
      .where(eq(convergenceOperations.id, convergenceId));
  }

  /**
   * Check if a convergence operation currently holds a lock
   */
  async hasLock(convergenceId: string): Promise<boolean> {
    const operation = await db.query.convergenceOperations.findFirst({
      where: eq(convergenceOperations.id, convergenceId),
    });

    if (!operation) return false;

    return (
      operation.status === ConvergenceStatus.VALIDATING ||
      operation.status === ConvergenceStatus.MERGING
    );
  }

  /**
   * Get the current lock holder for a target
   */
  async getLockHolder(targetRef: string): Promise<string | null> {
    const operation = await db.query.convergenceOperations.findFirst({
      where: and(
        eq(convergenceOperations.targetRef, targetRef),
        inArray(convergenceOperations.status, [
          ConvergenceStatus.VALIDATING,
          ConvergenceStatus.MERGING,
        ])
      ),
    });

    return operation?.id ?? null;
  }

  /**
   * Force release a stale lock (for admin/cleanup purposes)
   * Should only be used when a convergence operation is stuck
   */
  async forceReleaseLock(convergenceId: string): Promise<void> {
    await db
      .update(convergenceOperations)
      .set({
        status: ConvergenceStatus.FAILED,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(convergenceOperations.id, convergenceId),
          inArray(convergenceOperations.status, [
            ConvergenceStatus.VALIDATING,
            ConvergenceStatus.MERGING,
          ])
        )
      );
  }

  /**
   * Update lock status to merging phase
   */
  async transitionToMerging(convergenceId: string): Promise<void> {
    await db
      .update(convergenceOperations)
      .set({
        status: ConvergenceStatus.MERGING,
      })
      .where(eq(convergenceOperations.id, convergenceId));
  }
}

// Export singleton instance
export const lockingService = new LockingService();
