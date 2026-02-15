import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { eq } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import { snapshotService } from './snapshot-service.js';
import type { BranchComparison, FileDiff, DiffHunk } from '@echo-portal/shared';
import { NotFoundError } from '../../api/utils/errors.js';
import { getGitOperations } from '../git/operations.js';

/**
 * Service for branch comparison operations
 *
 * Provides diff data for the in-context review interface,
 * including divergence detection and file-level diffs.
 */
export class ComparisonService {
  /**
   * Get full branch comparison
   * Optionally uses a snapshot for consistent review state
   */
  async getBranchComparison(
    branchId: string,
    snapshotId?: string
  ): Promise<BranchComparison> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // If snapshot provided, use its commit refs for comparison
    let baseCommit = branch.baseCommit;
    let headCommit = branch.headCommit;

    if (snapshotId) {
      const snapshot = await snapshotService.getById(snapshotId);
      if (snapshot) {
        baseCommit = snapshot.baseCommit;
        headCommit = snapshot.headCommit;
      }
    }

    // Get full diff with hunk IDs
    const diff = await diffService.getBranchDiff(
      branch.gitRef,
      branch.baseRef,
      baseCommit,
      headCommit
    );

    // Add hunk IDs for comment anchoring
    const filesWithHunkIds: FileDiff[] = diff.files.map((file) => ({
      ...file,
      hunks: file.hunks.map((hunk, index) => {
        const { id: _id, ...rest } = hunk;
        return { ...rest, id: this.generateHunkId(file.path, index, hunk as DiffHunk) };
      }),
    }));

    // Check for base divergence
    const baseState = await this.checkBaseDivergence(branch.baseRef, branch.baseCommit);

    return {
      branchId,
      baseCommit,
      headCommit,
      baseRef: branch.baseRef,
      headRef: branch.gitRef,
      files: filesWithHunkIds,
      stats: diff.stats,
      baseState: baseState.diverged ? 'diverged' : 'current',
      divergedCommit: baseState.divergedCommit,
    };
  }

  /**
   * Get diff for a specific file
   */
  async getFileDiff(
    branchId: string,
    filePath: string,
    snapshotId?: string
  ): Promise<FileDiff | null> {
    const comparison = await this.getBranchComparison(branchId, snapshotId);
    return comparison.files.find((f) => f.path === filePath) || null;
  }

  /**
   * Check if the base branch has diverged since the branch was created
   *
   * This helps reviewers understand if they're reviewing against
   * a potentially outdated base.
   */
  async checkBaseDivergence(
    baseRef: string,
    originalBaseCommit: string
  ): Promise<{ diverged: boolean; divergedCommit?: string }> {
    try {
      const gitOps = getGitOperations();

      // Get the current head commit of the base ref
      const currentBaseCommit = await gitOps.getHeadCommit(baseRef);

      if (!currentBaseCommit) {
        // Can't determine - assume not diverged
        return { diverged: false };
      }

      if (currentBaseCommit !== originalBaseCommit) {
        return {
          diverged: true,
          divergedCommit: currentBaseCommit,
        };
      }

      return { diverged: false };
    } catch {
      // If we can't check, assume not diverged
      return { diverged: false };
    }
  }

  /**
   * Generate a stable hunk ID for comment anchoring
   *
   * The ID is based on file path, hunk position, and content hash
   * to provide reasonable stability across minor diff changes.
   */
  private generateHunkId(
    filePath: string,
    hunkIndex: number,
    hunk: DiffHunk
  ): string {
    // Create a content signature from first few lines
    const contentSignature = hunk.lines
      .slice(0, 3)
      .map((l) => l.content.slice(0, 20))
      .join('|');

    // Simple hash of the signature
    const hash = this.simpleHash(
      `${filePath}:${hunk.oldStart}:${hunk.newStart}:${contentSignature}`
    );

    return `hunk-${hunkIndex}-${hash}`;
  }

  /**
   * Simple string hash for hunk ID generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 8);
  }
}

// Export singleton instance
export const comparisonService = new ComparisonService();
