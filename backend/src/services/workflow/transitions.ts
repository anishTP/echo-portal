import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { branchStateTransitions } from '../../db/schema/branch-transitions.js';
import { eq } from 'drizzle-orm';
import {
  BranchState,
  ActorType,
  type BranchStateType,
  type TransitionEventType,
  type ActorTypeValue,
} from '@echo-portal/shared';
import type { TransitionContext, TransitionResult } from '@echo-portal/shared';
import {
  canPerformTransition,
  getTargetState,
  EventToTargetState,
} from './state-machine.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../api/utils/errors.js';
import { validationGuards, type GuardContext } from './validation.js';

/**
 * Options for executing a transition
 */
export interface TransitionOptions {
  branchId: string;
  event: TransitionEventType;
  actorId: string;
  actorType?: ActorTypeValue;
  actorRoles: string[];
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Service for handling branch state transitions
 */
export class TransitionService {
  /**
   * Execute a state transition on a branch
   */
  async executeTransition(options: TransitionOptions): Promise<TransitionResult> {
    const {
      branchId,
      event,
      actorId,
      actorType = ActorType.USER,
      actorRoles,
      reason,
      metadata = {},
    } = options;

    // Get the current branch state
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    const currentState = branch.state as BranchStateType;
    const targetState = getTargetState(event);

    // Check if transition is allowed
    const transitionCheck = canPerformTransition(currentState, event, actorRoles);
    if (!transitionCheck.allowed) {
      return {
        success: false,
        fromState: currentState,
        error: transitionCheck.reason,
      };
    }

    // Run validation guards
    const guardContext: GuardContext = {
      branchId,
      branch: {
        id: branch.id,
        ownerId: branch.ownerId,
        state: currentState,
        reviewers: branch.reviewers || [],
      },
      actorId,
      actorRoles,
      event,
      metadata,
    };

    const guardResults = await this.runGuards(event, guardContext);
    if (!guardResults.passed) {
      return {
        success: false,
        fromState: currentState,
        error: guardResults.error,
      };
    }

    // Execute the transition in a transaction
    const transitionResult = await db.transaction(async (tx) => {
      // Update the branch state
      const updateData: Record<string, unknown> = {
        state: targetState,
        updatedAt: new Date(),
      };

      // Set timestamp fields based on target state
      if (targetState === BranchState.REVIEW) {
        updateData.submittedAt = new Date();
      } else if (targetState === BranchState.APPROVED) {
        updateData.approvedAt = new Date();
      } else if (targetState === BranchState.PUBLISHED) {
        updateData.publishedAt = new Date();
      } else if (targetState === BranchState.ARCHIVED) {
        updateData.archivedAt = new Date();
      }

      await tx
        .update(branches)
        .set(updateData)
        .where(eq(branches.id, branchId));

      // Record the transition
      const [transition] = await tx
        .insert(branchStateTransitions)
        .values({
          branchId,
          fromState: currentState,
          toState: targetState,
          actorId,
          actorType,
          reason: reason || null,
          metadata,
        })
        .returning();

      return {
        success: true,
        fromState: currentState,
        toState: targetState,
        transitionId: transition.id,
      };
    });

    return transitionResult;
  }

  /**
   * Run validation guards for a transition event
   */
  private async runGuards(
    event: TransitionEventType,
    context: GuardContext
  ): Promise<{ passed: boolean; error?: string }> {
    const guards = validationGuards[event] || [];

    for (const guard of guards) {
      const passed = await guard.check(context);
      if (!passed) {
        return {
          passed: false,
          error: guard.errorMessage,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Get the transition history for a branch
   */
  async getTransitionHistory(branchId: string) {
    const transitions = await db.query.branchStateTransitions.findMany({
      where: eq(branchStateTransitions.branchId, branchId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return transitions.map((t) => ({
      id: t.id,
      fromState: t.fromState,
      toState: t.toState,
      actorId: t.actorId,
      actorType: t.actorType,
      reason: t.reason,
      metadata: (t.metadata as Record<string, unknown>) || {},
      createdAt: t.createdAt,
    }));
  }

  /**
   * Get the latest transition for a branch
   */
  async getLatestTransition(branchId: string) {
    const transition = await db.query.branchStateTransitions.findFirst({
      where: eq(branchStateTransitions.branchId, branchId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return transition;
  }

  /**
   * Check if a transition is possible (dry run)
   */
  async canTransition(options: Omit<TransitionOptions, 'reason' | 'metadata'>): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const { branchId, event, actorId, actorRoles } = options;

    // Get the current branch state
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return { allowed: false, reason: 'Branch not found' };
    }

    const currentState = branch.state as BranchStateType;

    // Check if transition is allowed
    const transitionCheck = canPerformTransition(currentState, event, actorRoles);
    if (!transitionCheck.allowed) {
      return transitionCheck;
    }

    // Run validation guards
    const guardContext: GuardContext = {
      branchId,
      branch: {
        id: branch.id,
        ownerId: branch.ownerId,
        state: currentState,
        reviewers: branch.reviewers || [],
      },
      actorId,
      actorRoles,
      event,
      metadata: {},
    };

    const guardResults = await this.runGuards(event, guardContext);
    if (!guardResults.passed) {
      return { allowed: false, reason: guardResults.error };
    }

    return { allowed: true };
  }
}

// Export singleton instance
export const transitionService = new TransitionService();
