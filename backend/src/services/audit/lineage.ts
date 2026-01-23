import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { branchTransitions } from '../../db/schema/branch-transitions.js';
import { convergence } from '../../db/schema/convergence.js';
import { users } from '../../db/schema/users.js';
import { eq, desc, and, inArray } from 'drizzle-orm';

export interface LineageNode {
  id: string;
  type: 'branch' | 'convergence' | 'published';
  name: string;
  state: string;
  createdAt: Date;
  actor?: {
    id: string;
    displayName: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LineageEvent {
  id: string;
  action: string;
  fromState?: string;
  toState?: string;
  timestamp: Date;
  actor?: {
    id: string;
    displayName: string;
  };
  reason?: string;
}

export interface BranchLineage {
  branch: {
    id: string;
    name: string;
    slug: string;
    state: string;
    visibility: string;
    createdAt: Date;
    owner: {
      id: string;
      displayName: string;
    };
  };
  baseRef: string;
  baseCommit: string;
  headCommit: string;
  events: LineageEvent[];
  convergence?: {
    id: string;
    status: string;
    mergedAt?: Date;
    targetBranch: string;
    mergeCommit?: string;
  };
  relatedBranches: {
    id: string;
    name: string;
    relationship: 'sibling' | 'child' | 'parent';
  }[];
}

/**
 * Service for tracing branch lineage and history
 */
export class LineageService {
  /**
   * Get complete lineage for a branch
   */
  async getBranchLineage(branchId: string): Promise<BranchLineage | null> {
    // Fetch branch with owner
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return null;
    }

    // Fetch owner details
    const owner = await db.query.users.findFirst({
      where: eq(users.id, branch.ownerId),
      columns: {
        id: true,
        displayName: true,
      },
    });

    // Fetch state transitions
    const transitions = await db.query.branchTransitions.findMany({
      where: eq(branchTransitions.branchId, branchId),
      orderBy: [desc(branchTransitions.createdAt)],
    });

    // Fetch actors for transitions
    const actorIds = [...new Set(transitions.map((t) => t.actorId))];
    const actors = actorIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, actorIds),
          columns: { id: true, displayName: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    // Build events list
    const events: LineageEvent[] = [
      // Creation event
      {
        id: `created-${branch.id}`,
        action: 'branch_created',
        toState: 'draft',
        timestamp: new Date(branch.createdAt),
        actor: owner || undefined,
      },
      // State transitions
      ...transitions.map((t) => ({
        id: t.id,
        action: 'state_transition',
        fromState: t.fromState,
        toState: t.toState,
        timestamp: new Date(t.createdAt),
        actor: actorMap.get(t.actorId) || undefined,
        reason: t.reason || undefined,
      })),
    ];

    // Sort events by timestamp
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Fetch convergence if exists
    const convergenceRecord = await db.query.convergence.findFirst({
      where: eq(convergence.branchId, branchId),
      orderBy: [desc(convergence.createdAt)],
    });

    // Find related branches (same base)
    const relatedBranches = await db.query.branches.findMany({
      where: and(
        eq(branches.baseRef, branch.baseRef),
        eq(branches.baseCommit, branch.baseCommit)
      ),
      columns: {
        id: true,
        name: true,
        createdAt: true,
      },
      limit: 10,
    });

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        state: branch.state,
        visibility: branch.visibility,
        createdAt: new Date(branch.createdAt),
        owner: owner || { id: branch.ownerId, displayName: 'Unknown' },
      },
      baseRef: branch.baseRef,
      baseCommit: branch.baseCommit,
      headCommit: branch.headCommit,
      events,
      convergence: convergenceRecord
        ? {
            id: convergenceRecord.id,
            status: convergenceRecord.status,
            mergedAt: convergenceRecord.mergedAt
              ? new Date(convergenceRecord.mergedAt)
              : undefined,
            targetBranch: convergenceRecord.targetBranch,
            mergeCommit: convergenceRecord.mergeCommit || undefined,
          }
        : undefined,
      relatedBranches: relatedBranches
        .filter((b) => b.id !== branchId)
        .map((b) => ({
          id: b.id,
          name: b.name,
          relationship: 'sibling' as const,
        })),
    };
  }

  /**
   * Get state transition timeline for a branch
   */
  async getStateTimeline(branchId: string): Promise<LineageEvent[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      return [];
    }

    const transitions = await db.query.branchTransitions.findMany({
      where: eq(branchTransitions.branchId, branchId),
      orderBy: [desc(branchTransitions.createdAt)],
    });

    // Fetch actors
    const actorIds = [...new Set([branch.ownerId, ...transitions.map((t) => t.actorId)])];
    const actors = await db.query.users.findMany({
      where: inArray(users.id, actorIds),
      columns: { id: true, displayName: true },
    });
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const timeline: LineageEvent[] = [
      {
        id: `created-${branch.id}`,
        action: 'branch_created',
        toState: 'draft',
        timestamp: new Date(branch.createdAt),
        actor: actorMap.get(branch.ownerId),
      },
    ];

    for (const t of transitions) {
      timeline.push({
        id: t.id,
        action: `transition_to_${t.toState}`,
        fromState: t.fromState,
        toState: t.toState,
        timestamp: new Date(t.createdAt),
        actor: actorMap.get(t.actorId),
        reason: t.reason || undefined,
      });
    }

    return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Trace the publication chain for a branch
   */
  async tracePublicationChain(
    branchId: string
  ): Promise<{ branchId: string; name: string; publishedAt: Date; mergeCommit: string }[]> {
    const chain: { branchId: string; name: string; publishedAt: Date; mergeCommit: string }[] = [];

    // Find all convergence records that published this branch or its ancestors
    const convergences = await db.query.convergence.findMany({
      where: and(
        eq(convergence.branchId, branchId),
        eq(convergence.status, 'succeeded')
      ),
      orderBy: [desc(convergence.mergedAt)],
    });

    for (const c of convergences) {
      const branch = await db.query.branches.findFirst({
        where: eq(branches.id, c.branchId),
      });

      if (branch && c.mergedAt && c.mergeCommit) {
        chain.push({
          branchId: c.branchId,
          name: branch.name,
          publishedAt: new Date(c.mergedAt),
          mergeCommit: c.mergeCommit,
        });
      }
    }

    return chain;
  }

  /**
   * Get a visual representation of branch relationships
   */
  async getBranchTree(
    baseRef: string = 'main',
    options: { limit?: number; includeArchived?: boolean } = {}
  ): Promise<LineageNode[]> {
    const { limit = 50, includeArchived = false } = options;

    const conditions = [eq(branches.baseRef, baseRef)];
    if (!includeArchived) {
      conditions.push(
        inArray(branches.state, ['draft', 'review', 'approved', 'published'])
      );
    }

    const branchList = await db.query.branches.findMany({
      where: and(...conditions),
      orderBy: [desc(branches.createdAt)],
      limit,
    });

    // Fetch owners
    const ownerIds = [...new Set(branchList.map((b) => b.ownerId))];
    const owners = await db.query.users.findMany({
      where: inArray(users.id, ownerIds),
      columns: { id: true, displayName: true },
    });
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    return branchList.map((b) => ({
      id: b.id,
      type: 'branch' as const,
      name: b.name,
      state: b.state,
      createdAt: new Date(b.createdAt),
      actor: ownerMap.get(b.ownerId),
      metadata: {
        slug: b.slug,
        visibility: b.visibility,
        baseCommit: b.baseCommit,
      },
    }));
  }
}

// Export singleton instance
export const lineageService = new LineageService();
