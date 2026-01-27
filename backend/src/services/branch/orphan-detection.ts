import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { eq, isNull, and, not, inArray } from 'drizzle-orm';

export interface OrphanedBranch {
  id: string;
  name: string;
  gitRef: string;
  baseRef: string;
  baseCommit: string;
  reason: string;
}

export interface OrphanDetectionResult {
  hasOrphans: boolean;
  orphanedBranches: OrphanedBranch[];
  checkedAt: string;
}

/**
 * Service to detect and prevent orphaned branches
 *
 * A branch is considered orphaned if:
 * 1. Its base commit no longer exists in the repository
 * 2. Its base branch (main/dev) has been force-pushed and lost the commit
 * 3. It references a deleted parent branch
 */
export class OrphanDetectionService {
  /**
   * Check if a specific branch would become orphaned
   * Used before creating or modifying branches
   */
  async validateBranchLineage(
    baseRef: string,
    baseCommit: string,
    gitCommitExists: (commit: string, ref: string) => Promise<boolean>
  ): Promise<{ valid: boolean; reason?: string }> {
    // Validate that base ref is valid
    if (!['main', 'dev'].includes(baseRef)) {
      return { valid: false, reason: `Invalid base ref: ${baseRef}. Must be 'main' or 'dev'.` };
    }

    // Validate that base commit exists
    const commitExists = await gitCommitExists(baseCommit, baseRef);
    if (!commitExists) {
      return {
        valid: false,
        reason: `Base commit ${baseCommit} does not exist on ${baseRef}. Branch would be orphaned.`,
      };
    }

    return { valid: true };
  }

  /**
   * Scan all branches for orphans
   * Returns list of branches that have become orphaned
   */
  async detectOrphanedBranches(
    gitCommitExists: (commit: string, ref: string) => Promise<boolean>
  ): Promise<OrphanDetectionResult> {
    const orphanedBranches: OrphanedBranch[] = [];

    // Get all non-archived branches
    const activeBranches = await db
      .select()
      .from(branches)
      .where(not(eq(branches.state, 'archived')));

    for (const branch of activeBranches) {
      const commitExists = await gitCommitExists(branch.baseCommit, branch.baseRef);

      if (!commitExists) {
        orphanedBranches.push({
          id: branch.id,
          name: branch.name,
          gitRef: branch.gitRef,
          baseRef: branch.baseRef,
          baseCommit: branch.baseCommit,
          reason: `Base commit ${branch.baseCommit} no longer exists on ${branch.baseRef}`,
        });
      }
    }

    return {
      hasOrphans: orphanedBranches.length > 0,
      orphanedBranches,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Prevent branch creation if it would be orphaned
   * This is a guard that should be called before creating any branch
   */
  async canCreateBranch(
    baseRef: string,
    baseCommit: string,
    gitCommitExists: (commit: string, ref: string) => Promise<boolean>
  ): Promise<{ allowed: boolean; reason?: string }> {
    const validation = await this.validateBranchLineage(baseRef, baseCommit, gitCommitExists);

    if (!validation.valid) {
      return { allowed: false, reason: validation.reason };
    }

    return { allowed: true };
  }

  /**
   * Mark orphaned branches
   * Can be used by a scheduled job to handle orphans
   */
  async handleOrphanedBranches(
    orphanedBranchIds: string[],
    action: 'archive' | 'flag' = 'flag'
  ): Promise<void> {
    if (orphanedBranchIds.length === 0) {
      return;
    }

    if (action === 'archive') {
      await db
        .update(branches)
        .set({
          state: 'archived',
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(branches.id, orphanedBranchIds));
    }

    // In 'flag' mode, we just log - actual flagging would need a metadata field
    console.warn(`Orphaned branches detected: ${orphanedBranchIds.join(', ')}`);
  }
}

// Export singleton instance
export const orphanDetectionService = new OrphanDetectionService();
