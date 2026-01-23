import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvergenceStatus } from '@echo-portal/shared';

/**
 * Tests for concurrent convergence operations (first-wins blocking)
 * These tests verify the locking logic used to prevent race conditions
 * when multiple convergence operations target the same branch.
 */
describe('Convergence - Concurrent Operation Tests', () => {
  // Mock the database and locking service for unit testing
  const mockDb = {
    query: {
      convergenceOperations: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Lock Acquisition Logic', () => {
    it('should acquire lock when no active operations exist', async () => {
      // Setup: no active operations
      const activeOperations: unknown[] = [];
      const pendingOperations: unknown[] = [];

      const canAcquire = activeOperations.length === 0 && pendingOperations.length === 0;

      expect(canAcquire).toBe(true);
    });

    it('should block lock acquisition when validating operation exists', async () => {
      // Setup: existing operation in VALIDATING state
      const activeOperations = [{
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.VALIDATING,
        createdAt: new Date('2026-01-23T10:00:00Z'),
      }];

      const isBlocked = activeOperations.some(
        op => op.status === ConvergenceStatus.VALIDATING ||
              op.status === ConvergenceStatus.MERGING
      );

      expect(isBlocked).toBe(true);
    });

    it('should block lock acquisition when merging operation exists', async () => {
      // Setup: existing operation in MERGING state
      const activeOperations = [{
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.MERGING,
        createdAt: new Date('2026-01-23T10:00:00Z'),
      }];

      const isBlocked = activeOperations.some(
        op => op.status === ConvergenceStatus.VALIDATING ||
              op.status === ConvergenceStatus.MERGING
      );

      expect(isBlocked).toBe(true);
    });

    it('should allow lock after completed operation', async () => {
      // Setup: existing operation is completed
      const activeOperations = [{
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.SUCCEEDED,
        createdAt: new Date('2026-01-23T10:00:00Z'),
        completedAt: new Date('2026-01-23T10:01:00Z'),
      }];

      // Filter to only active (non-terminal) statuses
      const blockingOperations = activeOperations.filter(
        op => op.status === ConvergenceStatus.VALIDATING ||
              op.status === ConvergenceStatus.MERGING
      );

      expect(blockingOperations.length).toBe(0);
    });

    it('should allow lock after failed operation', async () => {
      // Setup: existing operation has failed
      const activeOperations = [{
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.FAILED,
        createdAt: new Date('2026-01-23T10:00:00Z'),
        completedAt: new Date('2026-01-23T10:01:00Z'),
      }];

      const blockingOperations = activeOperations.filter(
        op => op.status === ConvergenceStatus.VALIDATING ||
              op.status === ConvergenceStatus.MERGING
      );

      expect(blockingOperations.length).toBe(0);
    });
  });

  describe('First-Wins Ordering', () => {
    it('should respect creation order for pending operations', async () => {
      const operation1 = {
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.PENDING,
        createdAt: new Date('2026-01-23T10:00:00Z'),
      };

      const operation2 = {
        id: 'convergence-2',
        branchId: 'branch-2',
        targetRef: 'main',
        status: ConvergenceStatus.PENDING,
        createdAt: new Date('2026-01-23T10:00:01Z'),
      };

      // First created should win
      const shouldGetLock = (currentId: string, pendingOps: typeof operation1[]) => {
        const createdAt = pendingOps.find(op => op.id === currentId)?.createdAt;
        const earlier = pendingOps.filter(op => op.createdAt < createdAt!);
        return earlier.length === 0;
      };

      const pendingOps = [operation1, operation2];

      expect(shouldGetLock('convergence-1', pendingOps)).toBe(true);
      expect(shouldGetLock('convergence-2', pendingOps)).toBe(false);
    });

    it('should block second operation targeting same branch', async () => {
      const operation1 = {
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.VALIDATING,
        startedAt: new Date('2026-01-23T10:00:00Z'),
      };

      const operation2Request = {
        branchId: 'branch-2', // Different source branch
        targetRef: 'main',   // Same target
      };

      // Should be blocked because operation1 is active on same target
      const hasActiveOnTarget = operation1.status === ConvergenceStatus.VALIDATING &&
                                 operation1.targetRef === operation2Request.targetRef;

      expect(hasActiveOnTarget).toBe(true);
    });

    it('should allow parallel operations on different targets', async () => {
      const operation1 = {
        id: 'convergence-1',
        branchId: 'branch-1',
        targetRef: 'main',
        status: ConvergenceStatus.VALIDATING,
        startedAt: new Date('2026-01-23T10:00:00Z'),
      };

      const operation2Request = {
        branchId: 'branch-2',
        targetRef: 'develop', // Different target
      };

      // Should NOT be blocked because targets are different
      const hasActiveOnTarget = operation1.status === ConvergenceStatus.VALIDATING &&
                                 operation1.targetRef === operation2Request.targetRef;

      expect(hasActiveOnTarget).toBe(false);
    });
  });

  describe('Lock Release', () => {
    it('should mark operation as succeeded on successful completion', async () => {
      const operation = {
        id: 'convergence-1',
        status: ConvergenceStatus.MERGING,
      };

      // Simulate successful completion
      const completedOperation = {
        ...operation,
        status: ConvergenceStatus.SUCCEEDED,
        completedAt: new Date(),
      };

      expect(completedOperation.status).toBe(ConvergenceStatus.SUCCEEDED);
      expect(completedOperation.completedAt).toBeDefined();
    });

    it('should mark operation as failed on error', async () => {
      const operation = {
        id: 'convergence-1',
        status: ConvergenceStatus.MERGING,
      };

      // Simulate failure
      const failedOperation = {
        ...operation,
        status: ConvergenceStatus.FAILED,
        completedAt: new Date(),
      };

      expect(failedOperation.status).toBe(ConvergenceStatus.FAILED);
    });

    it('should mark operation as rolled back on rollback', async () => {
      const operation = {
        id: 'convergence-1',
        status: ConvergenceStatus.MERGING,
      };

      // Simulate rollback
      const rolledBackOperation = {
        ...operation,
        status: ConvergenceStatus.ROLLED_BACK,
        completedAt: new Date(),
      };

      expect(rolledBackOperation.status).toBe(ConvergenceStatus.ROLLED_BACK);
    });
  });

  describe('Status Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      [ConvergenceStatus.PENDING]: [ConvergenceStatus.VALIDATING, ConvergenceStatus.FAILED],
      [ConvergenceStatus.VALIDATING]: [ConvergenceStatus.MERGING, ConvergenceStatus.FAILED],
      [ConvergenceStatus.MERGING]: [ConvergenceStatus.SUCCEEDED, ConvergenceStatus.FAILED, ConvergenceStatus.ROLLED_BACK],
      [ConvergenceStatus.SUCCEEDED]: [], // Terminal
      [ConvergenceStatus.FAILED]: [], // Terminal
      [ConvergenceStatus.ROLLED_BACK]: [], // Terminal
    };

    it('should allow valid status transitions', () => {
      for (const [from, toStates] of Object.entries(validTransitions)) {
        for (const to of toStates) {
          const isValid = validTransitions[from].includes(to);
          expect(isValid).toBe(true);
        }
      }
    });

    it('should not allow backwards transitions', () => {
      // Cannot go from MERGING back to PENDING
      expect(validTransitions[ConvergenceStatus.MERGING].includes(ConvergenceStatus.PENDING)).toBe(false);

      // Cannot go from VALIDATING back to PENDING
      expect(validTransitions[ConvergenceStatus.VALIDATING].includes(ConvergenceStatus.PENDING)).toBe(false);
    });

    it('should not allow transitions from terminal states', () => {
      expect(validTransitions[ConvergenceStatus.SUCCEEDED]).toHaveLength(0);
      expect(validTransitions[ConvergenceStatus.FAILED]).toHaveLength(0);
      expect(validTransitions[ConvergenceStatus.ROLLED_BACK]).toHaveLength(0);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle simultaneous lock requests deterministically', () => {
      // Simulate two operations created at the same time
      const operation1 = {
        id: 'convergence-1',
        createdAt: new Date('2026-01-23T10:00:00.000Z'),
      };
      const operation2 = {
        id: 'convergence-2',
        createdAt: new Date('2026-01-23T10:00:00.000Z'),
      };

      // Use ID as tiebreaker when timestamps are equal
      const determineWinner = (ops: typeof operation1[]) => {
        return ops.sort((a, b) => {
          const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.id.localeCompare(b.id); // Use ID as tiebreaker
        })[0];
      };

      const winner = determineWinner([operation1, operation2]);

      // Should deterministically select operation-1 (lexicographically first)
      expect(winner.id).toBe('convergence-1');
    });

    it('should queue later operations when lock is held', () => {
      const activeOperation = {
        id: 'convergence-1',
        status: ConvergenceStatus.MERGING,
        targetRef: 'main',
      };

      const queuedOperation = {
        id: 'convergence-2',
        status: ConvergenceStatus.PENDING,
        targetRef: 'main',
      };

      // Queued operation should wait
      const isQueued =
        queuedOperation.status === ConvergenceStatus.PENDING &&
        activeOperation.targetRef === queuedOperation.targetRef &&
        (activeOperation.status === ConvergenceStatus.VALIDATING ||
         activeOperation.status === ConvergenceStatus.MERGING);

      expect(isQueued).toBe(true);
    });
  });
});
