import { db } from '../../db/index.js';
import { reviewSnapshots, type NewReviewSnapshot } from '../../db/schema/review-snapshots.js';
import { branches } from '../../db/schema/branches.js';
import { eq } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import type { ReviewSnapshot, SnapshotData, FileSummary } from '@echo-portal/shared';
import { NotFoundError } from '../../api/utils/errors.js';

/**
 * Service for managing review snapshots
 *
 * Snapshots capture the comparison state at review submission time
 * for audit compliance (FR-003). Snapshots are immutable once created.
 */
export class SnapshotService {
  /**
   * Create a snapshot for a review
   * Captures the current branch diff state for later reference
   */
  async createSnapshot(reviewId: string, branchId: string): Promise<ReviewSnapshot> {
    // Get branch for commit refs
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Get diff summary for snapshot data
    const diffSummary = await diffService.getChangeSummary(
      branch.gitRef,
      branch.baseRef
    );

    // Build file summaries with status
    const files: FileSummary[] = [
      ...diffSummary.added.map((path) => ({
        path,
        status: 'added' as const,
        additions: 0, // Will be filled by full diff if needed
        deletions: 0,
      })),
      ...diffSummary.modified.map((path) => ({
        path,
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
      })),
      ...diffSummary.deleted.map((path) => ({
        path,
        status: 'deleted' as const,
        additions: 0,
        deletions: 0,
      })),
    ];

    // Get full diff for accurate stats
    const fullDiff = await diffService.getBranchDiff(
      branch.gitRef,
      branch.baseRef,
      branch.baseCommit,
      branch.headCommit
    );

    // Update file summaries with actual stats
    for (const file of fullDiff.files) {
      const summary = files.find((f) => f.path === file.path);
      if (summary) {
        summary.additions = file.additions;
        summary.deletions = file.deletions;
        if (file.oldPath) {
          summary.oldPath = file.oldPath;
        }
      }
    }

    const snapshotData: SnapshotData = {
      files,
      stats: fullDiff.stats,
      baseRef: branch.baseRef,
      headRef: branch.gitRef,
    };

    const newSnapshot: NewReviewSnapshot = {
      reviewId,
      branchId,
      baseCommit: branch.baseCommit,
      headCommit: branch.headCommit,
      snapshotData,
    };

    const [inserted] = await db
      .insert(reviewSnapshots)
      .values(newSnapshot)
      .returning();

    return {
      id: inserted.id,
      reviewId: inserted.reviewId,
      branchId: inserted.branchId,
      baseCommit: inserted.baseCommit,
      headCommit: inserted.headCommit,
      snapshotData: inserted.snapshotData as SnapshotData,
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  /**
   * Get snapshot by review ID
   */
  async getByReviewId(reviewId: string): Promise<ReviewSnapshot | null> {
    const snapshot = await db.query.reviewSnapshots.findFirst({
      where: eq(reviewSnapshots.reviewId, reviewId),
    });

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      reviewId: snapshot.reviewId,
      branchId: snapshot.branchId,
      baseCommit: snapshot.baseCommit,
      headCommit: snapshot.headCommit,
      snapshotData: snapshot.snapshotData as SnapshotData,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  /**
   * Get snapshot by ID
   */
  async getById(id: string): Promise<ReviewSnapshot | null> {
    const snapshot = await db.query.reviewSnapshots.findFirst({
      where: eq(reviewSnapshots.id, id),
    });

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      reviewId: snapshot.reviewId,
      branchId: snapshot.branchId,
      baseCommit: snapshot.baseCommit,
      headCommit: snapshot.headCommit,
      snapshotData: snapshot.snapshotData as SnapshotData,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  /**
   * Get snapshot by ID, throwing if not found
   */
  async getByIdOrThrow(id: string): Promise<ReviewSnapshot> {
    const snapshot = await this.getById(id);
    if (!snapshot) {
      throw new NotFoundError('ReviewSnapshot', id);
    }
    return snapshot;
  }
}

// Export singleton instance
export const snapshotService = new SnapshotService();
