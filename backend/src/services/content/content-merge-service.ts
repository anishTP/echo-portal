import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { buildLcsTable, computeLineDiff } from './diff-service.js';
import {
  computeChecksum,
  computeByteSize,
  createMetadataSnapshot,
} from '../../models/content.js';

// Types for merge operations
export interface ContentConflict {
  contentId: string;
  slug: string;
  conflictType: 'content' | 'metadata' | 'both';
  description: string;
  baseVersion?: {
    versionId: string;
    body: string;
    checksum: string;
  };
  oursVersion: {
    versionId: string;
    body: string;
    checksum: string;
  };
  theirsVersion: {
    versionId: string;
    body: string;
    checksum: string;
  };
  conflictMarkers?: string; // Body with conflict markers if applicable
}

export interface MergePreviewResult {
  canMerge: boolean;
  conflicts: ContentConflict[];
  autoMergeable: Array<{
    contentId: string;
    slug: string;
    changeType: 'added' | 'modified' | 'unchanged';
  }>;
  newInBranch: Array<{
    contentId: string;
    slug: string;
  }>;
}

export interface MergeResult {
  success: boolean;
  mergedCount: number;
  conflictCount: number;
  conflicts: ContentConflict[];
  mergedContent: Array<{
    sourceContentId: string;
    targetContentId: string;
    slug: string;
  }>;
}

export interface ThreeWayMergeResult {
  merged: boolean;
  hasConflict: boolean;
  result?: string;
  conflictMarkers?: string;
}

/**
 * Three-way merge algorithm for text content.
 *
 * Given:
 * - base: content at branch creation (merge base)
 * - ours: current content in target (main's published version)
 * - theirs: content in source branch
 *
 * Returns merged content or conflict markers.
 */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string
): ThreeWayMergeResult {
  // Fast path: if checksums match, no merge needed
  if (ours === theirs) {
    return { merged: true, hasConflict: false, result: ours };
  }

  // If only one side changed, take that side
  if (base === ours && base !== theirs) {
    // Only "theirs" changed - take theirs
    return { merged: true, hasConflict: false, result: theirs };
  }

  if (base === theirs && base !== ours) {
    // Only "ours" changed - keep ours
    return { merged: true, hasConflict: false, result: ours };
  }

  // Both sides changed - need to do line-by-line merge
  const baseLines = base.split('\n');
  const oursLines = ours.split('\n');
  const theirsLines = theirs.split('\n');

  // Get changes from base to each side
  const ourChanges = getLineChanges(baseLines, oursLines);
  const theirChanges = getLineChanges(baseLines, theirsLines);

  // Check for overlapping changes (conflicts)
  const conflicts = findOverlappingChanges(ourChanges, theirChanges);

  if (conflicts.length === 0) {
    // No conflicts - can auto-merge
    const merged = applyNonConflictingChanges(baseLines, ourChanges, theirChanges);
    return { merged: true, hasConflict: false, result: merged.join('\n') };
  }

  // Has conflicts - generate conflict markers
  const withMarkers = generateConflictMarkers(baseLines, oursLines, theirsLines, conflicts);
  return {
    merged: false,
    hasConflict: true,
    conflictMarkers: withMarkers,
  };
}

interface LineChange {
  type: 'add' | 'remove' | 'modify';
  baseLine: number; // Line number in base (0-indexed, -1 for additions)
  startLine: number;
  endLine: number;
  content: string[];
}

function getLineChanges(baseLines: string[], newLines: string[]): LineChange[] {
  const changes: LineChange[] = [];
  const dp = buildLcsTable(baseLines, newLines);

  let i = baseLines.length;
  let j = newLines.length;

  // Track ranges of changes
  let currentRemove: number[] = [];
  let currentAdd: string[] = [];
  let lastBasePos = i;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && baseLines[i - 1] === newLines[j - 1]) {
      // Lines match - flush any pending changes
      if (currentRemove.length > 0 || currentAdd.length > 0) {
        changes.unshift({
          type: currentAdd.length > 0 && currentRemove.length > 0 ? 'modify' :
                currentAdd.length > 0 ? 'add' : 'remove',
          baseLine: currentRemove.length > 0 ? currentRemove[0] : lastBasePos,
          startLine: currentRemove.length > 0 ? currentRemove[0] : lastBasePos,
          endLine: lastBasePos,
          content: currentAdd,
        });
        currentRemove = [];
        currentAdd = [];
      }
      lastBasePos = i - 1;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Addition in new
      currentAdd.unshift(newLines[j - 1]);
      j--;
    } else if (i > 0) {
      // Removal from base
      currentRemove.unshift(i - 1);
      i--;
    }
  }

  // Flush any remaining changes
  if (currentRemove.length > 0 || currentAdd.length > 0) {
    changes.unshift({
      type: currentAdd.length > 0 && currentRemove.length > 0 ? 'modify' :
            currentAdd.length > 0 ? 'add' : 'remove',
      baseLine: currentRemove.length > 0 ? currentRemove[0] : 0,
      startLine: currentRemove.length > 0 ? currentRemove[0] : 0,
      endLine: currentRemove.length > 0 ? currentRemove[currentRemove.length - 1] + 1 : 0,
      content: currentAdd,
    });
  }

  return changes;
}

interface ConflictRegion {
  baseStart: number;
  baseEnd: number;
}

function findOverlappingChanges(ourChanges: LineChange[], theirChanges: LineChange[]): ConflictRegion[] {
  const conflicts: ConflictRegion[] = [];

  for (const ourChange of ourChanges) {
    for (const theirChange of theirChanges) {
      // Check if changes overlap in the base
      const ourStart = ourChange.baseLine;
      const ourEnd = ourChange.endLine;
      const theirStart = theirChange.baseLine;
      const theirEnd = theirChange.endLine;

      // Ranges overlap if one starts before the other ends
      if (ourStart <= theirEnd && theirStart <= ourEnd) {
        conflicts.push({
          baseStart: Math.min(ourStart, theirStart),
          baseEnd: Math.max(ourEnd, theirEnd),
        });
      }
    }
  }

  // Merge overlapping conflict regions
  if (conflicts.length <= 1) return conflicts;

  conflicts.sort((a, b) => a.baseStart - b.baseStart);
  const merged: ConflictRegion[] = [conflicts[0]];

  for (let i = 1; i < conflicts.length; i++) {
    const last = merged[merged.length - 1];
    const current = conflicts[i];

    if (current.baseStart <= last.baseEnd) {
      last.baseEnd = Math.max(last.baseEnd, current.baseEnd);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function applyNonConflictingChanges(
  baseLines: string[],
  ourChanges: LineChange[],
  theirChanges: LineChange[]
): string[] {
  // Simple implementation: apply both sets of changes
  // Since there are no conflicts, changes don't overlap
  const result = [...baseLines];
  const allChanges = [...ourChanges, ...theirChanges].sort((a, b) => b.baseLine - a.baseLine);

  for (const change of allChanges) {
    if (change.type === 'add') {
      result.splice(change.baseLine, 0, ...change.content);
    } else if (change.type === 'remove') {
      result.splice(change.startLine, change.endLine - change.startLine);
    } else {
      // modify: remove old lines and add new ones
      result.splice(change.startLine, change.endLine - change.startLine, ...change.content);
    }
  }

  return result;
}

function generateConflictMarkers(
  baseLines: string[],
  oursLines: string[],
  theirsLines: string[],
  conflicts: ConflictRegion[]
): string {
  // For simplicity, generate git-style conflict markers
  const result: string[] = [];
  let baseIdx = 0;

  for (const conflict of conflicts) {
    // Add lines before conflict
    while (baseIdx < conflict.baseStart) {
      result.push(baseLines[baseIdx]);
      baseIdx++;
    }

    // Add conflict markers
    result.push('<<<<<<< ours (main)');
    // Find corresponding ours lines (simplified - use full section)
    for (let i = conflict.baseStart; i < Math.min(conflict.baseEnd, oursLines.length); i++) {
      if (oursLines[i]) result.push(oursLines[i]);
    }
    result.push('=======');
    // Find corresponding theirs lines
    for (let i = conflict.baseStart; i < Math.min(conflict.baseEnd, theirsLines.length); i++) {
      if (theirsLines[i]) result.push(theirsLines[i]);
    }
    result.push('>>>>>>> theirs (branch)');

    baseIdx = conflict.baseEnd;
  }

  // Add remaining lines
  while (baseIdx < baseLines.length) {
    result.push(baseLines[baseIdx]);
    baseIdx++;
  }

  return result.join('\n');
}

/**
 * Service for merging content during convergence
 */
export const contentMergeService = {
  /**
   * Preview merge conflicts without actually merging.
   */
  async detectConflicts(
    branchId: string,
    targetBranchId: string
  ): Promise<MergePreviewResult> {
    const conflicts: ContentConflict[] = [];
    const autoMergeable: MergePreviewResult['autoMergeable'] = [];
    const newInBranch: MergePreviewResult['newInBranch'] = [];

    // Get all content in the source branch
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    for (const content of branchContent) {
      // Get current version
      const currentVersion = content.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, content.currentVersionId),
          })
        : null;

      if (!currentVersion) continue;

      // Check if this content has a source (inherited from main)
      if (content.sourceContentId) {
        // This is an update to existing main content
        const sourceContent = await db.query.contents.findFirst({
          where: eq(schema.contents.id, content.sourceContentId),
        });

        if (!sourceContent) {
          // Source was deleted - treat as new
          newInBranch.push({ contentId: content.id, slug: content.slug });
          continue;
        }

        // Get base version (version at branch creation)
        const baseVersion = content.baseVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, content.baseVersionId),
            })
          : null;

        // Get main's current published version
        const mainVersion = sourceContent.publishedVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, sourceContent.publishedVersionId),
            })
          : null;

        if (!mainVersion || !baseVersion) {
          autoMergeable.push({ contentId: content.id, slug: content.slug, changeType: 'modified' });
          continue;
        }

        // Check if content was modified in branch
        if (currentVersion.checksum === baseVersion.checksum) {
          // No changes in branch
          autoMergeable.push({ contentId: content.id, slug: content.slug, changeType: 'unchanged' });
          continue;
        }

        // Check if main was modified since branch creation
        if (mainVersion.checksum === baseVersion.checksum) {
          // Main unchanged - branch changes win
          autoMergeable.push({ contentId: content.id, slug: content.slug, changeType: 'modified' });
          continue;
        }

        // Both modified - try three-way merge
        const mergeResult = threeWayMerge(
          baseVersion.body,
          mainVersion.body,
          currentVersion.body
        );

        if (mergeResult.hasConflict) {
          conflicts.push({
            contentId: content.id,
            slug: content.slug,
            conflictType: 'content',
            description: `Content "${content.title}" was modified in both main and branch`,
            baseVersion: {
              versionId: baseVersion.id,
              body: baseVersion.body,
              checksum: baseVersion.checksum,
            },
            oursVersion: {
              versionId: mainVersion.id,
              body: mainVersion.body,
              checksum: mainVersion.checksum,
            },
            theirsVersion: {
              versionId: currentVersion.id,
              body: currentVersion.body,
              checksum: currentVersion.checksum,
            },
            conflictMarkers: mergeResult.conflictMarkers,
          });
        } else {
          autoMergeable.push({ contentId: content.id, slug: content.slug, changeType: 'modified' });
        }
      } else {
        // New content created in branch
        newInBranch.push({ contentId: content.id, slug: content.slug });
      }
    }

    return {
      canMerge: conflicts.length === 0,
      conflicts,
      autoMergeable,
      newInBranch,
    };
  },

  /**
   * Merge content from a branch into main during convergence.
   */
  async mergeContentIntoMain(
    branchId: string,
    mainBranchId: string,
    actorId: string
  ): Promise<MergeResult> {
    const conflicts: ContentConflict[] = [];
    const mergedContent: MergeResult['mergedContent'] = [];

    // First detect conflicts
    const preview = await this.detectConflicts(branchId, mainBranchId);
    if (!preview.canMerge) {
      return {
        success: false,
        mergedCount: 0,
        conflictCount: preview.conflicts.length,
        conflicts: preview.conflicts,
        mergedContent: [],
      };
    }

    // Get all content in the branch
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    for (const content of branchContent) {
      const currentVersion = content.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, content.currentVersionId),
          })
        : null;

      if (!currentVersion) continue;

      try {
        if (content.sourceContentId) {
          // Update existing main content
          const sourceContent = await db.query.contents.findFirst({
            where: eq(schema.contents.id, content.sourceContentId),
          });

          if (!sourceContent) continue;

          // Get versions for three-way merge
          const baseVersion = content.baseVersionId
            ? await db.query.contentVersions.findFirst({
                where: eq(schema.contentVersions.id, content.baseVersionId),
              })
            : null;

          const mainVersion = sourceContent.publishedVersionId
            ? await db.query.contentVersions.findFirst({
                where: eq(schema.contentVersions.id, sourceContent.publishedVersionId),
              })
            : null;

          // Determine merged content
          let mergedBody = currentVersion.body;
          if (baseVersion && mainVersion && mainVersion.checksum !== baseVersion.checksum) {
            // Both changed - merge (we know there's no conflict from preview)
            const mergeResult = threeWayMerge(
              baseVersion.body,
              mainVersion.body,
              currentVersion.body
            );
            if (mergeResult.result) {
              mergedBody = mergeResult.result;
            }
          }

          // Create new version in main's content
          await db.transaction(async (tx) => {
            const metadataSnapshot = createMetadataSnapshot({
              title: content.title,
              category: content.category ?? undefined,
              tags: content.tags ?? [],
            });

            const [newVersion] = await tx
              .insert(schema.contentVersions)
              .values({
                contentId: sourceContent.id,
                parentVersionId: sourceContent.publishedVersionId,
                body: mergedBody,
                bodyFormat: currentVersion.bodyFormat,
                metadataSnapshot,
                changeDescription: `Merged from branch: ${currentVersion.changeDescription || 'content update'}`,
                authorId: actorId,
                authorType: 'user',
                byteSize: computeByteSize(mergedBody),
                checksum: computeChecksum(mergedBody),
              })
              .returning();

            // Update main content with new published version
            await tx
              .update(schema.contents)
              .set({
                currentVersionId: newVersion.id,
                publishedVersionId: newVersion.id,
                title: content.title,
                category: content.category,
                tags: content.tags,
                description: content.description,
                visibility: 'public',
                isPublished: true,
                publishedAt: new Date(),
                publishedBy: actorId,
                updatedAt: new Date(),
              })
              .where(eq(schema.contents.id, sourceContent.id));

            // Mark branch content as published
            await tx
              .update(schema.contents)
              .set({
                isPublished: true,
                publishedVersionId: currentVersion.id,
                publishedAt: new Date(),
                publishedBy: actorId,
              })
              .where(eq(schema.contents.id, content.id));

            // Record in merge history
            await tx.insert(schema.contentMergeHistory).values({
              contentId: sourceContent.id,
              operationType: 'merge',
              sourceBranchId: branchId,
              targetBranchId: mainBranchId,
              baseVersionId: content.baseVersionId,
              sourceVersionId: currentVersion.id,
              resultVersionId: newVersion.id,
              hadConflict: false,
              conflictResolution: 'auto',
              actorId,
              metadata: { mergedFromContentId: content.id },
            });
          });

          mergedContent.push({
            sourceContentId: content.id,
            targetContentId: sourceContent.id,
            slug: content.slug,
          });
        } else {
          // New content - check if slug already exists in main first
          const existingInMain = await db.query.contents.findFirst({
            where: and(
              eq(schema.contents.branchId, mainBranchId),
              eq(schema.contents.slug, content.slug)
            ),
          });

          if (existingInMain) {
            // Content with same slug already exists in main - update it instead of creating duplicate
            await db.transaction(async (tx) => {
              const metadataSnapshot = createMetadataSnapshot({
                title: content.title,
                category: content.category ?? undefined,
                tags: content.tags ?? [],
              });

              // Create new version for existing main content
              const [newVersion] = await tx
                .insert(schema.contentVersions)
                .values({
                  contentId: existingInMain.id,
                  parentVersionId: existingInMain.currentVersionId,
                  body: currentVersion.body,
                  bodyFormat: currentVersion.bodyFormat,
                  metadataSnapshot,
                  changeDescription: `Merged from branch: ${currentVersion.changeDescription || 'content update'}`,
                  authorId: actorId,
                  authorType: 'user',
                  byteSize: currentVersion.byteSize,
                  checksum: currentVersion.checksum,
                })
                .returning();

              // Update existing main content
              await tx
                .update(schema.contents)
                .set({
                  currentVersionId: newVersion.id,
                  publishedVersionId: newVersion.id,
                  title: content.title,
                  category: content.category,
                  tags: content.tags,
                  description: content.description,
                  visibility: 'public',
                  isPublished: true,
                  publishedAt: new Date(),
                  publishedBy: actorId,
                  updatedAt: new Date(),
                })
                .where(eq(schema.contents.id, existingInMain.id));

              // Update source content to link to main
              await tx
                .update(schema.contents)
                .set({
                  isPublished: true,
                  publishedVersionId: currentVersion.id,
                  publishedAt: new Date(),
                  publishedBy: actorId,
                  sourceContentId: existingInMain.id,
                })
                .where(eq(schema.contents.id, content.id));

              // Record in merge history
              await tx.insert(schema.contentMergeHistory).values({
                contentId: existingInMain.id,
                operationType: 'merge',
                sourceBranchId: branchId,
                targetBranchId: mainBranchId,
                sourceVersionId: currentVersion.id,
                resultVersionId: newVersion.id,
                hadConflict: false,
                conflictResolution: 'auto',
                actorId,
                metadata: { mergedFromContentId: content.id, wasOrphanedContent: true },
              });
            });

            mergedContent.push({
              sourceContentId: content.id,
              targetContentId: existingInMain.id,
              slug: content.slug,
            });
            continue;
          }

          // Truly new content - copy to main
          await db.transaction(async (tx) => {
            const metadataSnapshot = createMetadataSnapshot({
              title: content.title,
              category: content.category ?? undefined,
              tags: content.tags ?? [],
            });

            // Create new content in main
            const [newContent] = await tx
              .insert(schema.contents)
              .values({
                branchId: mainBranchId,
                slug: content.slug,
                title: content.title,
                contentType: content.contentType,
                category: content.category,
                tags: content.tags,
                description: content.description,
                visibility: 'public',
                isPublished: true,
                publishedAt: new Date(),
                publishedBy: actorId,
                createdBy: actorId,
              })
              .returning();

            // Copy the current version
            const [newVersion] = await tx
              .insert(schema.contentVersions)
              .values({
                contentId: newContent.id,
                body: currentVersion.body,
                bodyFormat: currentVersion.bodyFormat,
                metadataSnapshot,
                changeDescription: 'Initial publish from branch',
                authorId: actorId,
                authorType: 'user',
                byteSize: currentVersion.byteSize,
                checksum: currentVersion.checksum,
              })
              .returning();

            // Update content references
            await tx
              .update(schema.contents)
              .set({
                currentVersionId: newVersion.id,
                publishedVersionId: newVersion.id,
              })
              .where(eq(schema.contents.id, newContent.id));

            // Update source content to link to main
            await tx
              .update(schema.contents)
              .set({
                isPublished: true,
                publishedVersionId: currentVersion.id,
                publishedAt: new Date(),
                publishedBy: actorId,
                sourceContentId: newContent.id,
              })
              .where(eq(schema.contents.id, content.id));

            // Record in merge history
            await tx.insert(schema.contentMergeHistory).values({
              contentId: newContent.id,
              operationType: 'merge',
              sourceBranchId: branchId,
              targetBranchId: mainBranchId,
              sourceVersionId: currentVersion.id,
              resultVersionId: newVersion.id,
              hadConflict: false,
              actorId,
              metadata: { newContentCreated: true, fromContentId: content.id },
            });

            mergedContent.push({
              sourceContentId: content.id,
              targetContentId: newContent.id,
              slug: content.slug,
            });
          });
        }
      } catch (error) {
        console.error(`Failed to merge content ${content.id}:`, error);
        // Continue with other content
      }
    }

    return {
      success: true,
      mergedCount: mergedContent.length,
      conflictCount: 0,
      conflicts: [],
      mergedContent,
    };
  },

  /**
   * Get merge history for a content item.
   */
  async getMergeHistory(contentId: string) {
    return db.query.contentMergeHistory.findMany({
      where: eq(schema.contentMergeHistory.contentId, contentId),
      orderBy: (cmh, { desc }) => [desc(cmh.createdAt)],
    });
  },
};
