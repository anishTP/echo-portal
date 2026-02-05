import { db } from '../../db/index.js';
import { contents } from '../../db/schema/contents.js';
import { contentVersions } from '../../db/schema/contents.js';
import { eq, and, isNull } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import type { DiffHunk as LocalDiffHunk } from '../git/diff.js';
import type {
  BranchComparison,
  FileDiff,
  ContentComparisonStats,
  ContentComparisonStatsItem,
  FullContentData,
} from '@echo-portal/shared';

interface ContentMetadata {
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
}

/**
 * Serialize content metadata into diffable lines.
 * Produces a YAML-like frontmatter block that can be compared line by line.
 */
function serializeMetadata(meta: ContentMetadata): string[] {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: ${meta.title}`);
  if (meta.description) {
    lines.push(`description: ${meta.description}`);
  }
  if (meta.category) {
    lines.push(`category: ${meta.category}`);
  }
  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags: ${meta.tags.join(', ')}`);
  }
  lines.push('---');
  return lines;
}

/**
 * Service for DB-backed content comparison.
 *
 * Bypasses the git/worktree layer entirely and compares content
 * stored in PostgreSQL (contents + contentVersions tables).
 * Compares both metadata (title, description, category, tags) and body.
 */
export class ContentComparisonService {
  /**
   * Get full content comparison for a branch.
   *
   * For each branch content item:
   * - Items with sourceContentId + hasEdits: compare metadata + body against source
   * - Items without sourceContentId: treat as all-additions (new content)
   * - Items with sourceContentId but no edits: skip (unchanged)
   */
  async getContentComparison(branchId: string): Promise<BranchComparison> {
    const branchContents = await db
      .select({
        id: contents.id,
        title: contents.title,
        slug: contents.slug,
        description: contents.description,
        category: contents.category,
        tags: contents.tags,
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
      const branchVersion = item.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(contentVersions.id, item.currentVersionId),
          })
        : null;

      const branchBody = branchVersion?.body || '';

      if (item.sourceContentId) {
        const hasEdits = item.createdAt.getTime() !== item.updatedAt.getTime();
        if (!hasEdits) continue;

        // Fetch source content + version
        const sourceContent = await db.query.contents.findFirst({
          where: eq(contents.id, item.sourceContentId),
        });

        if (!sourceContent?.currentVersionId) continue;

        const sourceVersion = await db.query.contentVersions.findFirst({
          where: eq(contentVersions.id, sourceContent.currentVersionId),
        });

        const sourceBody = sourceVersion?.body || '';

        // Compare metadata
        const sourceMeta: ContentMetadata = {
          title: sourceContent.title,
          description: sourceContent.description,
          category: sourceContent.category,
          tags: sourceContent.tags,
        };
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          tags: item.tags,
        };

        const sourceMetaLines = serializeMetadata(sourceMeta);
        const branchMetaLines = serializeMetadata(branchMeta);
        const metaDiff = diffService.computeLineDiff(sourceMetaLines, branchMetaLines);

        // Compare body
        const sourceBodyLines = sourceBody.split('\n');
        const branchBodyLines = branchBody.split('\n');
        const bodyDiff = diffService.computeLineDiff(sourceBodyLines, branchBodyLines);

        const totalItemAdditions = metaDiff.additions + bodyDiff.additions;
        const totalItemDeletions = metaDiff.deletions + bodyDiff.deletions;

        if (totalItemAdditions === 0 && totalItemDeletions === 0) continue;

        // Combine hunks: metadata hunks first, then body hunks (skip context-only hunks)
        const allHunks: LocalDiffHunk[] = [];
        for (const hunk of metaDiff.hunks) {
          if (hunk.lines.some((l) => l.type !== 'context')) {
            allHunks.push(hunk);
          }
        }
        for (const hunk of bodyDiff.hunks) {
          if (!hunk.lines.some((l) => l.type !== 'context')) continue;
          // Offset body hunk line numbers to account for metadata block
          const metaLineCount = sourceMetaLines.length;
          allHunks.push({
            ...hunk,
            oldStart: hunk.oldStart > 0 ? hunk.oldStart + metaLineCount : hunk.oldStart,
            newStart: hunk.newStart > 0 ? hunk.newStart + metaLineCount : hunk.newStart,
            lines: hunk.lines.map((line) => ({
              ...line,
              oldLineNumber: line.oldLineNumber ? line.oldLineNumber + metaLineCount : undefined,
              newLineNumber: line.newLineNumber ? line.newLineNumber + metaLineCount : undefined,
            })),
          });
        }

        const hunksWithIds = allHunks.map((hunk, index) => ({
          ...hunk,
          id: this.generateHunkId(item.title, index, hunk),
        }));

        // Build full content data for article-level diff view
        const fullContent: FullContentData = {
          oldContent: sourceBody,
          newContent: branchBody,
          metadata: {
            old: {
              title: sourceContent.title,
              description: sourceContent.description,
              category: sourceContent.category,
              tags: sourceContent.tags || [],
            },
            new: {
              title: item.title,
              description: item.description,
              category: item.category,
              tags: item.tags || [],
            },
          },
        };

        files.push({
          path: item.title,
          contentId: item.id,
          status: 'modified' as const,
          additions: totalItemAdditions,
          deletions: totalItemDeletions,
          hunks: hunksWithIds,
          fullContent,
        });

        totalAdditions += totalItemAdditions;
        totalDeletions += totalItemDeletions;
      } else {
        // New content (no source) — combine metadata + body as all-additions
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          tags: item.tags,
        };
        const metaLines = serializeMetadata(branchMeta);
        const bodyLines = branchBody.split('\n');
        const allLines = [...metaLines, '', ...bodyLines];

        if (allLines.length === 0) continue;

        const hunks = diffService.createAdditionHunks(allLines);
        const hunksWithIds = hunks.map((hunk, index) => ({
          ...hunk,
          id: this.generateHunkId(item.title, index, hunk),
        }));

        // Build full content data for article-level diff view (new content)
        const fullContent: FullContentData = {
          oldContent: null, // No source for new content
          newContent: branchBody,
          metadata: {
            old: null,
            new: {
              title: item.title,
              description: item.description,
              category: item.category,
              tags: item.tags || [],
            },
          },
        };

        files.push({
          path: item.title,
          contentId: item.id,
          status: 'added' as const,
          additions: allLines.length,
          deletions: 0,
          hunks: hunksWithIds,
          fullContent,
        });

        totalAdditions += allLines.length;
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
        description: contents.description,
        category: contents.category,
        tags: contents.tags,
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

        // Compare metadata
        const sourceMeta: ContentMetadata = {
          title: sourceContent.title,
          description: sourceContent.description,
          category: sourceContent.category,
          tags: sourceContent.tags,
        };
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          tags: item.tags,
        };

        const sourceMetaLines = serializeMetadata(sourceMeta);
        const branchMetaLines = serializeMetadata(branchMeta);
        const metaDiff = diffService.computeLineDiff(sourceMetaLines, branchMetaLines);

        // Compare body
        const sourceBodyLines = sourceBody.split('\n');
        const branchBodyLines = branchBody.split('\n');
        const bodyDiff = diffService.computeLineDiff(sourceBodyLines, branchBodyLines);

        const additions = metaDiff.additions + bodyDiff.additions;
        const deletions = metaDiff.deletions + bodyDiff.deletions;

        if (additions === 0 && deletions === 0) continue;

        items.push({
          contentId: item.id,
          title: item.title,
          status: 'modified',
          additions,
          deletions,
        });

        totalAdditions += additions;
        totalDeletions += deletions;
      } else {
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          tags: item.tags,
        };
        const metaLines = serializeMetadata(branchMeta);
        const bodyLines = branchBody.split('\n');
        const allLineCount = metaLines.length + 1 + bodyLines.length; // +1 for blank separator

        if (allLineCount <= 1) continue;

        items.push({
          contentId: item.id,
          title: item.title,
          status: 'added',
          additions: allLineCount,
          deletions: 0,
        });

        totalAdditions += allLineCount;
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
