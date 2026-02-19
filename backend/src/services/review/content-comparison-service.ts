import { db } from '../../db/index.js';
import { contents } from '../../db/schema/contents.js';
import { contentVersions } from '../../db/schema/contents.js';
import { subcategories } from '../../db/schema/subcategories.js';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
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
  subcategoryName: string | null;
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
  if (meta.subcategoryName) {
    lines.push(`subcategory: ${meta.subcategoryName}`);
  }
  if (meta.tags && meta.tags.length > 0) {
    lines.push(`tags: ${meta.tags.join(', ')}`);
  }
  lines.push('---');
  return lines;
}

/**
 * Batch-resolve subcategory IDs to their display names.
 * Returns a map of subcategoryId → name.
 */
async function resolveSubcategoryNames(ids: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (ids.length === 0) return nameMap;

  const uniqueIds = [...new Set(ids)];
  const rows = await db
    .select({ id: subcategories.id, name: subcategories.name })
    .from(subcategories)
    .where(inArray(subcategories.id, uniqueIds));

  for (const row of rows) {
    nameMap.set(row.id, row.name);
  }
  return nameMap;
}

/**
 * Service for DB-backed content comparison.
 *
 * Bypasses the git/worktree layer entirely and compares content
 * stored in PostgreSQL (contents + contentVersions tables).
 * Compares both metadata (title, description, category, tags, subcategory) and body.
 */
export class ContentComparisonService {
  /**
   * Get full content comparison for a branch.
   *
   * For each branch content item:
   * - Items with sourceContentId: compare metadata + body against source
   * - Items without sourceContentId: treat as all-additions (new content)
   * - Source content not in branch: treat as deletions
   */
  async getContentComparison(branchId: string): Promise<BranchComparison> {
    const branchContents = await db
      .select({
        id: contents.id,
        title: contents.title,
        slug: contents.slug,
        description: contents.description,
        category: contents.category,
        subcategoryId: contents.subcategoryId,
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

    // Also query archived (deleted) branch content to discover deletions
    const archivedContents = await db
      .select({
        id: contents.id,
        sourceContentId: contents.sourceContentId,
      })
      .from(contents)
      .where(
        and(
          eq(contents.branchId, branchId),
          sql`${contents.archivedAt} IS NOT NULL`
        )
      );

    if (branchContents.length === 0 && archivedContents.length === 0) {
      return this.emptyComparison(branchId);
    }

    // Collect all subcategory IDs for batch resolution
    const subcatIds: string[] = [];
    for (const item of branchContents) {
      if (item.subcategoryId) subcatIds.push(item.subcategoryId);
    }

    // Collect source IDs from both active and archived content
    const activeSourceIds = branchContents
      .filter((item) => item.sourceContentId)
      .map((item) => item.sourceContentId!);
    const archivedSourceIds = archivedContents
      .filter((item) => item.sourceContentId)
      .map((item) => item.sourceContentId!);
    const sourceContentIds = [...new Set([...activeSourceIds, ...archivedSourceIds])];

    // Batch-fetch all source content
    const sourceContentMap = new Map<string, typeof branchContents[0] & { currentVersionId: string | null }>();
    if (sourceContentIds.length > 0) {
      const sourceRows = await db
        .select({
          id: contents.id,
          title: contents.title,
          slug: contents.slug,
          description: contents.description,
          category: contents.category,
          subcategoryId: contents.subcategoryId,
          tags: contents.tags,
          sourceContentId: contents.sourceContentId,
          currentVersionId: contents.currentVersionId,
          createdAt: contents.createdAt,
          updatedAt: contents.updatedAt,
        })
        .from(contents)
        .where(inArray(contents.id, sourceContentIds));

      for (const row of sourceRows) {
        sourceContentMap.set(row.id, row);
        if (row.subcategoryId) subcatIds.push(row.subcategoryId);
      }
    }

    // Batch-resolve all subcategory names
    const subcatNames = await resolveSubcategoryNames(subcatIds);

    const files: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    // Track which source content IDs are referenced by branch content
    const referencedSourceIds = new Set<string>();

    for (const item of branchContents) {
      const branchVersion = item.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(contentVersions.id, item.currentVersionId),
          })
        : null;

      const branchBody = branchVersion?.body || '';

      if (item.sourceContentId) {
        referencedSourceIds.add(item.sourceContentId);

        // Always fetch source and compare — no hasEdits shortcut
        const sourceContent = sourceContentMap.get(item.sourceContentId);

        if (!sourceContent?.currentVersionId) continue;

        const sourceVersion = await db.query.contentVersions.findFirst({
          where: eq(contentVersions.id, sourceContent.currentVersionId),
        });

        const sourceBody = sourceVersion?.body || '';

        // Compare metadata (including subcategory name)
        const sourceMeta: ContentMetadata = {
          title: sourceContent.title,
          description: sourceContent.description,
          category: sourceContent.category,
          subcategoryName: sourceContent.subcategoryId
            ? subcatNames.get(sourceContent.subcategoryId) ?? null
            : null,
          tags: sourceContent.tags,
        };
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          subcategoryName: item.subcategoryId
            ? subcatNames.get(item.subcategoryId) ?? null
            : null,
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
          subcategoryName: item.subcategoryId
            ? subcatNames.get(item.subcategoryId) ?? null
            : null,
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

    // Phase 5: Detect deleted content — source content not present in branch
    for (const [sourceId, sourceContent] of sourceContentMap) {
      if (referencedSourceIds.has(sourceId)) {
        // Check if the branch content referencing this source is actually active (not archived)
        const branchItem = branchContents.find((c) => c.sourceContentId === sourceId);
        if (branchItem) continue; // Still active in branch
      }

      // This source content has no active branch counterpart — it was deleted
      if (!sourceContent.currentVersionId) continue;

      const sourceVersion = await db.query.contentVersions.findFirst({
        where: eq(contentVersions.id, sourceContent.currentVersionId),
      });

      const sourceBody = sourceVersion?.body || '';

      const sourceMeta: ContentMetadata = {
        title: sourceContent.title,
        description: sourceContent.description,
        category: sourceContent.category,
        subcategoryName: sourceContent.subcategoryId
          ? subcatNames.get(sourceContent.subcategoryId) ?? null
          : null,
        tags: sourceContent.tags,
      };

      const metaLines = serializeMetadata(sourceMeta);
      const bodyLines = sourceBody.split('\n');
      const allLines = [...metaLines, '', ...bodyLines];

      if (allLines.length === 0) continue;

      const deletionHunks = diffService.createDeletionHunks(allLines);

      const hunksWithIds = deletionHunks.map((hunk, index) => ({
        ...hunk,
        id: this.generateHunkId(sourceContent.title, index, hunk),
      }));

      const fullContent: FullContentData = {
        oldContent: sourceBody,
        newContent: null,
        metadata: {
          old: {
            title: sourceContent.title,
            description: sourceContent.description,
            category: sourceContent.category,
            tags: sourceContent.tags || [],
          },
          new: null,
        },
      };

      files.push({
        path: sourceContent.title,
        contentId: sourceId,
        status: 'deleted' as const,
        additions: 0,
        deletions: allLines.length,
        hunks: hunksWithIds,
        fullContent,
      });

      totalDeletions += allLines.length;
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
        subcategoryId: contents.subcategoryId,
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

    // Also query archived content to discover deletions
    const archivedContents = await db
      .select({
        id: contents.id,
        sourceContentId: contents.sourceContentId,
      })
      .from(contents)
      .where(
        and(
          eq(contents.branchId, branchId),
          sql`${contents.archivedAt} IS NOT NULL`
        )
      );

    // Collect subcategory IDs for batch resolution
    const subcatIds: string[] = [];
    for (const item of branchContents) {
      if (item.subcategoryId) subcatIds.push(item.subcategoryId);
    }

    // Collect source IDs from both active and archived content
    const activeSourceIds = branchContents
      .filter((item) => item.sourceContentId)
      .map((item) => item.sourceContentId!);
    const archivedSourceIds = archivedContents
      .filter((item) => item.sourceContentId)
      .map((item) => item.sourceContentId!);
    const sourceContentIds = [...new Set([...activeSourceIds, ...archivedSourceIds])];

    const sourceContentMap = new Map<string, typeof branchContents[0]>();
    if (sourceContentIds.length > 0) {
      const sourceRows = await db
        .select({
          id: contents.id,
          title: contents.title,
          description: contents.description,
          category: contents.category,
          subcategoryId: contents.subcategoryId,
          tags: contents.tags,
          sourceContentId: contents.sourceContentId,
          currentVersionId: contents.currentVersionId,
          createdAt: contents.createdAt,
          updatedAt: contents.updatedAt,
        })
        .from(contents)
        .where(inArray(contents.id, sourceContentIds));

      for (const row of sourceRows) {
        sourceContentMap.set(row.id, row);
        if (row.subcategoryId) subcatIds.push(row.subcategoryId);
      }
    }

    const subcatNames = await resolveSubcategoryNames(subcatIds);

    const items: ContentComparisonStatsItem[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    // Track referenced source IDs for deletion detection
    const referencedSourceIds = new Set<string>();

    for (const item of branchContents) {
      const branchVersion = item.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(contentVersions.id, item.currentVersionId),
          })
        : null;

      const branchBody = branchVersion?.body || '';

      if (item.sourceContentId) {
        referencedSourceIds.add(item.sourceContentId);

        // Always fetch source and compare — no hasEdits shortcut
        const sourceContent = sourceContentMap.get(item.sourceContentId);

        if (!sourceContent?.currentVersionId) continue;

        const sourceVersion = await db.query.contentVersions.findFirst({
          where: eq(contentVersions.id, sourceContent.currentVersionId),
        });

        const sourceBody = sourceVersion?.body || '';

        // Compare metadata (including subcategory)
        const sourceMeta: ContentMetadata = {
          title: sourceContent.title,
          description: sourceContent.description,
          category: sourceContent.category,
          subcategoryName: sourceContent.subcategoryId
            ? subcatNames.get(sourceContent.subcategoryId) ?? null
            : null,
          tags: sourceContent.tags,
        };
        const branchMeta: ContentMetadata = {
          title: item.title,
          description: item.description,
          category: item.category,
          subcategoryName: item.subcategoryId
            ? subcatNames.get(item.subcategoryId) ?? null
            : null,
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
          subcategoryName: item.subcategoryId
            ? subcatNames.get(item.subcategoryId) ?? null
            : null,
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

    // Detect deleted content — source content not in active branch
    for (const [sourceId, sourceContent] of sourceContentMap) {
      if (referencedSourceIds.has(sourceId)) {
        const branchItem = branchContents.find((c) => c.sourceContentId === sourceId);
        if (branchItem) continue;
      }

      if (!sourceContent.currentVersionId) continue;

      const sourceVersion = await db.query.contentVersions.findFirst({
        where: eq(contentVersions.id, sourceContent.currentVersionId),
      });

      const sourceBody = sourceVersion?.body || '';

      const sourceMeta: ContentMetadata = {
        title: sourceContent.title,
        description: sourceContent.description,
        category: sourceContent.category,
        subcategoryName: sourceContent.subcategoryId
          ? subcatNames.get(sourceContent.subcategoryId) ?? null
          : null,
        tags: sourceContent.tags,
      };

      const metaLines = serializeMetadata(sourceMeta);
      const bodyLines = sourceBody.split('\n');
      const allLineCount = metaLines.length + 1 + bodyLines.length;

      items.push({
        contentId: sourceId,
        title: sourceContent.title,
        status: 'deleted',
        additions: 0,
        deletions: allLineCount,
      });

      totalDeletions += allLineCount;
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
