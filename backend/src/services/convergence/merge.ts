import { getGitOperations } from '../git/operations.js';
import type { ValidationResult, ConflictDetail } from '@echo-portal/shared';

export interface MergeResult {
  success: boolean;
  mergeCommit?: string;
  error?: string;
  rolledBack?: boolean;
}

export interface MergeContext {
  branchRef: string;
  targetRef: string;
  branchId: string;
  publisherId: string;
  message?: string;
}

/**
 * Service for performing atomic merge operations with rollback support
 */
export class MergeService {
  /**
   * Perform an atomic merge with rollback on failure
   */
  async atomicMerge(context: MergeContext): Promise<MergeResult> {
    const gitOps = getGitOperations();
    const { branchRef, targetRef, publisherId, message } = context;

    // Store the current HEAD of target for potential rollback
    let targetHeadBefore: string;

    try {
      targetHeadBefore = await gitOps.getHeadCommit(targetRef);
    } catch (error) {
      return {
        success: false,
        error: `Failed to get current HEAD of ${targetRef}`,
      };
    }

    try {
      // Perform the merge
      const mergeMessage =
        message || `Merge branch '${branchRef}' into ${targetRef}`;

      const mergeCommit = await gitOps.mergeBranch(branchRef, targetRef, {
        message: mergeMessage,
        author: publisherId,
      });

      return {
        success: true,
        mergeCommit,
      };
    } catch (error) {
      // Attempt rollback
      const rollbackResult = await this.rollback(targetRef, targetHeadBefore);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Merge failed',
        rolledBack: rollbackResult,
      };
    }
  }

  /**
   * Rollback to a previous commit
   */
  private async rollback(ref: string, commitSha: string): Promise<boolean> {
    const gitOps = getGitOperations();

    try {
      await gitOps.resetToCommit(ref, commitSha);
      return true;
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  /**
   * Perform a dry-run merge to check if it would succeed
   */
  async dryRunMerge(branchRef: string, targetRef: string): Promise<{
    canMerge: boolean;
    conflicts: ConflictDetail[];
  }> {
    const gitOps = getGitOperations();

    try {
      const result = await gitOps.checkMergeability(branchRef, targetRef);
      return {
        canMerge: result.canMerge,
        conflicts: result.conflicts || [],
      };
    } catch (error) {
      return {
        canMerge: false,
        conflicts: [
          {
            path: '*',
            type: 'content',
            description: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Get the commit message for a convergence merge
   */
  getConvergenceMergeMessage(branchName: string, branchId: string): string {
    return `Converge branch '${branchName}' (${branchId.slice(0, 8)})

This merge was performed through Echo Portal's convergence process.
All changes have been validated and approved before merging.`;
  }
}

// Export singleton instance
export const mergeService = new MergeService();
