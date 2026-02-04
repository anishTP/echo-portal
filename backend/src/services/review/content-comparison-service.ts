import { db } from '../../db/index.js';
import { contents } from '../../db/schema/contents.js';
import { contentVersions } from '../../db/schema/contents.js';
import { eq, and, isNull } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import type { DiffHunk as LocalDiffHunk } from '../git/diff.js';
import type {
  BranchComparison,
  FileDiff,
  DiffHunk,
  ContentComparisonStats,
  ContentComparisonStatsItem,
} from '@echo-portal/shared';

/**
 * Service for DB-backed content comparison.
 *
 * Bypasses the git/worktree layer entirely and compares content
 * bodies stored in PostgreSQL (contents + contentVersions tables).
 */
export class ContentComparisonService {
  /**
   * Get full content comparison for a branch.
   *
   * For each branch content item:
   * - Items with sourceContentId + hasEdits: compare against source body
   * - Items without sourceContentId: treat as all-additions (new content)
   * - Items with sourceContentId but no edits: skip (unchanged)
   */
  async getContentComparison(branchId: string): Promise<BranchComparison> {
    // Get all non-archived content for the branch with their current versions
    const branchContents = await db
      .select({
        id: contents.id,
        title: contents.title,
        slug: contents.slug,
        sourceContentId: contents.sourceContentId,
        currentVersionId: contents.currentVersionId,
        createdAt: contents.createdAt,
        updatedAt: contents.updatedAt,
      })
      .from(contents)
      .where(
        and(
          eq(contents.branchId, branchId),
          isNull(contents.archivedAt)
        )
      );

    if (branchContents.length === 0) {
      return this.emptyComparison(branchId);
    }

    const files: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const item of branchContents) {
      // Get the branch content's current version body
      const branchVersion = item.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(contentVersions.id, item.currentVersionId),
          })
        : null;

      const branchBody = branchVersion?.body || '';

      if (item.sourceContentId) {
        // This content was forked from a source — check if it was edited
        const hasEdits = item.createdAt.getTime() !== item.updatedAt.getTime();
        if (!hasEdits) continue; // Skip unchanged items

        // Fetch source content's current version body
        const sourceContent = await db.query.contents.findFirst({
          where: eq(contents.id, item.sourceContentId),
        });

        if (!sourceContent?.currentVersionId) continue;

        const sourceVersion = await db.query.contentVersions.findFirst({
          where: eq(contentVersions.id, sourceContent.currentVersionId),
        });

        const sourceBody = sourceVersion?.body || '';

        // Compute line diff
        const oldLines = sourceBody.split('\n');
        const newLines = branchBody.split('\n');
        const diff = diffService.computeLineDiff(oldLines, newLines);

        if (diff.additions === 0 && diff.deletions === 0) continue; // No actual changes

        const hunksWithIds = diff.hunks.map((hunk, index) => ({
          ...hunk,
          id: this.generateHunkId(item.title, index, hunk),
        }));

        files.push({
          path: item.title,
          contentId: item.id,
          status: 'modified' as const,
          additions: diff.additions,
          deletions: diff.deletions,
          hunks: hunksWithIds,
        });

        totalAdditions += diff.additions;
        totalDeletions += diff.deletions;
      } else {
        // New content (no source) — treat all lines as additions
        const lines = branchBody.split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) continue;

        const hunks = diffService.createAdditionHunks(lines);
        const hunksWithIds = hunks.map((hunk, index) => ({
          ...hunk,
          id: this.generateHunkId(item.title, index, hunk),
        }));

        files.push({
          path: item.title,
          contentId: item.id,
          status: 'added' as const,
          additions: lines.length,
          deletions: 0,
          hunks: hunksWithIds,
        });

        totalAdditions += lines.length;
      }
    }

    return {
      branchId,
      baseCommit: branchId,
      headCommit: branchId,
      baseRef: 'main',
      headRef: branchId,
      files,
      stats: {
        filesChanged: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
      },
      baseState: 'current',
    };
  }

  /**
   * Get lightweight comparison stats for sidebar display.
   * Same query logic but skips full hunk computation.
   */
  async getContentComparisonStats(branchId: string): Promise<ContentComparisonStats> {
    const branchContents = await db
      .select({
        id: contents.id,
        title: contents.title,
        sourceContentId: contents.sourceContentId,
        currentVersionId: contents.currentVersionId,
        createdAt: contents.createdAt,
        updatedAt: contents.updatedAt,
      })
      .from(contents)
      .where(
        and(
          eq(contents.branchId, branchId),
          isNull(contents.archivedAt)
        )
      );

    const items: ContentComparisonStatsItem[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const item of branchContents) {
      const branchVersion = item.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(contentVersions.id, item.currentVersionId),
          })
        : null;

      const branchBody = branchVersion?.body || '';

      if (item.sourceContentId) {
        const hasEdits = item.createdAt.getTime() !== item.updatedAt.getTime();
        if (!hasEdits) continue;

        const sourceContent = await db.query.contents.findFirst({
          where: eq(contents.id, item.sourceContentId),
        });

        if (!sourceContent?.currentVersionId) continue;

        const sourceVersion = await db.query.contentVersions.findFirst({
          where: eq(contentVersions.id, sourceContent.currentVersionId),
        });

        const sourceBody = sourceVersion?.body || '';

        // Count additions/deletions without building full hunks
        const oldLines = sourceBody.split('\n');
        const newLines = branchBody.split('\n');
        const diff = diffService.computeLineDiff(oldLines, newLines);

        if (diff.additions === 0 && diff.deletions === 0) continue;

        items.push({
          contentId: item.id,
          title: item.title,
          status: 'modified',
          additions: diff.additions,
          deletions: diff.deletions,
        });

        totalAdditions += diff.additions;
        totalDeletions += diff.deletions;
      } else {
        const lines = branchBody.split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) continue;

        items.push({
          contentId: item.id,
          title: item.title,
          status: 'added',
          additions: lines.length,
          deletions: 0,
        });

        totalAdditions += lines.length;
      }
    }

    return {
      branchId,
      items,
      totals: {
        filesChanged: items.length,
        additions: totalAdditions,
        deletions: totalDeletions,
      },
    };
  }

  private emptyComparison(branchId: string): BranchComparison {
    return {
      branchId,
      baseCommit: branchId,
      headCommit: branchId,
      baseRef: 'main',
      headRef: branchId,
      files: [],
      stats: { filesChanged: 0, additions: 0, deletions: 0 },
      baseState: 'current',
    };
  }

  /**
   * Generate a stable hunk ID for comment anchoring.
   * Uses same pattern as ComparisonService.generateHunkId.
   */
  private generateHunkId(
    title: string,
    hunkIndex: number,
    hunk: LocalDiffHunk
  ): string {
    const contentSignature = hunk.lines
      .slice(0, 3)
      .map((l) => l.content.slice(0, 20))
      .join('|');

    const hash = this.simpleHash(
      `${title}:${hunk.oldStart}:${hunk.newStart}:${contentSignature}`
    );

    return `hunk-${hunkIndex}-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).slice(0, 8);
  }
}

export const contentComparisonService = new ContentComparisonService();
