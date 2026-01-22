import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { branchStateTransitions } from '../../db/schema/branch-transitions.js';
import { convergenceOperations } from '../../db/schema/convergence.js';
import { eq, desc } from 'drizzle-orm';

export interface LineageNode {
  branchId: string;
  branchName: string;
  state: string;
  baseRef: string;
  baseCommit: string;
  headCommit: string;
  createdAt: string;
  publishedAt?: string;
}

export interface LineageChain {
  branch: LineageNode;
  tracesToMain: boolean;
  publishedAncestor?: LineageNode;
  chainLength: number;
  transitions: {
    from: string;
    to: string;
    timestamp: string;
    actorId: string;
  }[];
}

export interface LineageValidationResult {
  valid: boolean;
  reason?: string;
  lineage?: LineageChain;
}

/**
 * Service to validate and trace branch lineage
 *
 * Ensures all branches can trace back to a known published state (main branch)
 * This prevents dangling branches and maintains audit integrity
 */
export class LineageValidationService {
  /**
   * Validate that a branch traces to a known published state
   */
  async validateLineage(branchId: string): Promise<LineageValidationResult> {
    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return { valid: false, reason: 'Branch not found' };
    }

    // Get the transition history
    const transitions = await db
      .select()
      .from(branchStateTransitions)
      .where(eq(branchStateTransitions.branchId, branchId))
      .orderBy(desc(branchStateTransitions.createdAt));

    // Build lineage chain
    const lineageChain: LineageChain = {
      branch: {
        branchId: branch.id,
        branchName: branch.name,
        state: branch.state,
        baseRef: branch.baseRef,
        baseCommit: branch.baseCommit,
        headCommit: branch.headCommit,
        createdAt: branch.createdAt.toISOString(),
        publishedAt: branch.publishedAt?.toISOString(),
      },
      tracesToMain: branch.baseRef === 'main' || branch.baseRef === 'dev',
      chainLength: 1,
      transitions: transitions.map((t) => ({
        from: t.fromState,
        to: t.toState,
        timestamp: t.createdAt.toISOString(),
        actorId: t.actorId,
      })),
    };

    // For branches based on 'main', they automatically trace to published state
    if (branch.baseRef === 'main') {
      lineageChain.tracesToMain = true;
      return { valid: true, lineage: lineageChain };
    }

    // For branches based on 'dev', they also trace to a known state
    // (dev is an intermediary that eventually traces to main)
    if (branch.baseRef === 'dev') {
      lineageChain.tracesToMain = true;
      return { valid: true, lineage: lineageChain };
    }

    // If baseRef is something else, this is an invalid branch
    return {
      valid: false,
      reason: `Branch has invalid base ref: ${branch.baseRef}. Must trace to 'main' or 'dev'.`,
      lineage: lineageChain,
    };
  }

  /**
   * Get the full lineage tree for a branch
   * Shows all state transitions and related operations
   */
  async getLineageTree(branchId: string): Promise<{
    branch: LineageNode | null;
    transitions: Array<{
      id: string;
      from: string;
      to: string;
      actorId: string;
      actorType: string;
      reason?: string;
      timestamp: string;
    }>;
    convergences: Array<{
      id: string;
      status: string;
      publisherId: string;
      createdAt: string;
      completedAt?: string;
    }>;
  }> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return { branch: null, transitions: [], convergences: [] };
    }

    const transitions = await db
      .select()
      .from(branchStateTransitions)
      .where(eq(branchStateTransitions.branchId, branchId))
      .orderBy(branchStateTransitions.createdAt);

    const convergences = await db
      .select()
      .from(convergenceOperations)
      .where(eq(convergenceOperations.branchId, branchId))
      .orderBy(convergenceOperations.createdAt);

    return {
      branch: {
        branchId: branch.id,
        branchName: branch.name,
        state: branch.state,
        baseRef: branch.baseRef,
        baseCommit: branch.baseCommit,
        headCommit: branch.headCommit,
        createdAt: branch.createdAt.toISOString(),
        publishedAt: branch.publishedAt?.toISOString(),
      },
      transitions: transitions.map((t) => ({
        id: t.id,
        from: t.fromState,
        to: t.toState,
        actorId: t.actorId,
        actorType: t.actorType,
        reason: t.reason || undefined,
        timestamp: t.createdAt.toISOString(),
      })),
      convergences: convergences.map((c) => ({
        id: c.id,
        status: c.status,
        publisherId: c.publisherId,
        createdAt: c.createdAt.toISOString(),
        completedAt: c.completedAt?.toISOString(),
      })),
    };
  }

  /**
   * Check if a branch has a clean lineage for convergence
   * Must have complete audit trail and no gaps
   */
  async isConvergenceReady(branchId: string): Promise<{
    ready: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Validate basic lineage
    const lineageResult = await this.validateLineage(branchId);
    if (!lineageResult.valid) {
      issues.push(lineageResult.reason || 'Invalid lineage');
    }

    // Check branch is in approved state
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return { ready: false, issues: ['Branch not found'] };
    }

    if (branch.state !== 'approved') {
      issues.push(`Branch must be in 'approved' state, currently: ${branch.state}`);
    }

    // Check for required transitions (draft → review → approved)
    const transitions = await db
      .select()
      .from(branchStateTransitions)
      .where(eq(branchStateTransitions.branchId, branchId))
      .orderBy(branchStateTransitions.createdAt);

    const hasReviewTransition = transitions.some(
      (t) => t.fromState === 'draft' && t.toState === 'review'
    );
    const hasApprovalTransition = transitions.some(
      (t) => t.fromState === 'review' && t.toState === 'approved'
    );

    if (!hasReviewTransition) {
      issues.push('Missing review transition in audit trail');
    }
    if (!hasApprovalTransition) {
      issues.push('Missing approval transition in audit trail');
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const lineageValidationService = new LineageValidationService();
