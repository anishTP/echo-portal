import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { threeWayMerge, type ContentConflict } from './content-merge-service.js';
import {
  computeChecksum,
  computeByteSize,
  createMetadataSnapshot,
} from '../../models/content.js';
import { branchService } from '../branch/branch-service.js';
import { contentInheritanceService, type ContentManifest } from './content-inheritance-service.js';

export interface RebasePreviewResult {
  canRebase: boolean;
  newContentFromMain: Array<{
    slug: string;
    contentId: string;
    title: string;
  }>;
  updatedInMain: Array<{
    slug: string;
    contentId: string;
    title: string;
    hasConflict: boolean;
  }>;
  deletedInMain: Array<{
    slug: string;
    branchContentId: string;
  }>;
  conflicts: ContentConflict[];
}

export interface RebaseResult {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  conflictCount: number;
  conflicts: ContentConflict[];
  newBaseCommit?: string;
}

// Track in-progress rebase operations
const rebaseInProgress = new Map<string, {
  conflicts: ContentConflict[];
  resolvedConflicts: Set<string>;
  startedAt: Date;
}>();

/**
 * Service for rebasing branch content onto latest main
 */
export const contentRebaseService = {
  /**
   * Preview what a rebase would do without making changes.
   */
  async previewRebase(branchId: string): Promise<RebasePreviewResult> {
    const branch = await branchService.getByIdOrThrow(branchId);
    const mainBranch = await branchService.getMainBranchOrThrow();

    const conflicts: ContentConflict[] = [];
    const newContentFromMain: RebasePreviewResult['newContentFromMain'] = [];
    const updatedInMain: RebasePreviewResult['updatedInMain'] = [];
    const deletedInMain: RebasePreviewResult['deletedInMain'] = [];

    // Get branch's content snapshot (state at creation)
    const snapshot = await contentInheritanceService.getSnapshot(branchId);
    const baseManifest: ContentManifest = (snapshot?.contentManifest as ContentManifest) || {};

    // Get current main published content
    const mainContent = await db.query.contents.findMany({
      where: and(
        eq(schema.contents.branchId, mainBranch.id),
        eq(schema.contents.isPublished, true)
      ),
    });

    // Get current branch content
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    const branchContentBySlug = new Map(branchContent.map((c) => [c.slug, c]));
    const baseManifestSlugs = new Set(Object.keys(baseManifest));

    // Check main content for updates/additions
    for (const mainItem of mainContent) {
      const branchItem = branchContentBySlug.get(mainItem.slug);
      const wasInBase = baseManifestSlugs.has(mainItem.slug);

      if (!wasInBase) {
        // New content in main since branch was created
        if (!branchItem) {
          newContentFromMain.push({
            slug: mainItem.slug,
            contentId: mainItem.id,
            title: mainItem.title,
          });
        }
        continue;
      }

      // Content existed at branch creation
      const baseEntry = baseManifest[mainItem.slug];
      const mainVersion = mainItem.publishedVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, mainItem.publishedVersionId),
          })
        : null;

      if (!mainVersion) continue;

      // Check if main was updated since branch creation
      if (mainVersion.checksum === baseEntry?.checksum) {
        // Main unchanged - no action needed
        continue;
      }

      // Main was updated - check if branch also modified this content
      if (!branchItem) {
        // Branch deleted this content but main updated it - this is a delete conflict
        // For now, we'll let main's version win (user can re-delete if needed)
        newContentFromMain.push({
          slug: mainItem.slug,
          contentId: mainItem.id,
          title: mainItem.title,
        });
        continue;
      }

      const branchVersion = branchItem.currentVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, branchItem.currentVersionId),
          })
        : null;

      const baseVersion = branchItem.baseVersionId
        ? await db.query.contentVersions.findFirst({
            where: eq(schema.contentVersions.id, branchItem.baseVersionId),
          })
        : null;

      if (!branchVersion || !baseVersion) continue;

      // Check if branch modified the content
      if (branchVersion.checksum === baseVersion.checksum) {
        // Branch didn't modify - can fast-forward to main's version
        updatedInMain.push({
          slug: mainItem.slug,
          contentId: mainItem.id,
          title: mainItem.title,
          hasConflict: false,
        });
        continue;
      }

      // Both modified - try three-way merge
      const mergeResult = threeWayMerge(
        baseVersion.body,
        mainVersion.body,
        branchVersion.body
      );

      if (mergeResult.hasConflict) {
        conflicts.push({
          contentId: branchItem.id,
          slug: branchItem.slug,
          conflictType: 'content',
          description: `Content "${branchItem.title}" was modified in both main and branch during rebase`,
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
            versionId: branchVersion.id,
            body: branchVersion.body,
            checksum: branchVersion.checksum,
          },
          conflictMarkers: mergeResult.conflictMarkers,
        });
        updatedInMain.push({
          slug: mainItem.slug,
          contentId: mainItem.id,
          title: mainItem.title,
          hasConflict: true,
        });
      } else {
        updatedInMain.push({
          slug: mainItem.slug,
          contentId: mainItem.id,
          title: mainItem.title,
          hasConflict: false,
        });
      }
    }

    // Check for content deleted in main
    const mainSlugs = new Set(mainContent.map((c) => c.slug));
    for (const slug of baseManifestSlugs) {
      if (!mainSlugs.has(slug)) {
        const branchItem = branchContentBySlug.get(slug);
        if (branchItem && branchItem.sourceContentId) {
          deletedInMain.push({
            slug,
            branchContentId: branchItem.id,
          });
        }
      }
    }

    return {
      canRebase: conflicts.length === 0,
      newContentFromMain,
      updatedInMain,
      deletedInMain,
      conflicts,
    };
  },

  /**
   * Execute a rebase - update branch with latest main changes.
   */
  async rebase(branchId: string, actorId: string): Promise<RebaseResult> {
    const branch = await branchService.getByIdOrThrow(branchId);
    const mainBranch = await branchService.getMainBranchOrThrow();

    // Check if branch can be rebased (must be in draft state)
    if (branch.state !== 'draft') {
      throw new Error('Only draft branches can be rebased');
    }

    // Preview to check for conflicts
    const preview = await this.previewRebase(branchId);

    if (!preview.canRebase) {
      // Store conflicts for later resolution
      rebaseInProgress.set(branchId, {
        conflicts: preview.conflicts,
        resolvedConflicts: new Set(),
        startedAt: new Date(),
      });

      // Mark content items in conflict state
      for (const conflict of preview.conflicts) {
        await db
          .update(schema.contents)
          .set({
            mergeState: 'conflict',
            conflictData: conflict,
          })
          .where(eq(schema.contents.id, conflict.contentId));
      }

      return {
        success: false,
        addedCount: 0,
        updatedCount: 0,
        conflictCount: preview.conflicts.length,
        conflicts: preview.conflicts,
      };
    }

    let addedCount = 0;
    let updatedCount = 0;

    // Add new content from main
    for (const newItem of preview.newContentFromMain) {
      try {
        const mainItem = await db.query.contents.findFirst({
          where: eq(schema.contents.id, newItem.contentId),
        });
        if (!mainItem) continue;

        const mainVersion = mainItem.publishedVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, mainItem.publishedVersionId),
            })
          : null;
        if (!mainVersion) continue;

        await db.transaction(async (tx) => {
          const metadataSnapshot = createMetadataSnapshot({
            title: mainItem.title,
            category: mainItem.category ?? undefined,
            tags: mainItem.tags ?? [],
          });

          const [newContent] = await tx
            .insert(schema.contents)
            .values({
              branchId,
              slug: mainItem.slug,
              title: mainItem.title,
              contentType: mainItem.contentType,
              category: mainItem.category,
              tags: mainItem.tags,
              description: mainItem.description,
              visibility: mainItem.visibility,
              sourceContentId: mainItem.id,
              baseVersionId: mainVersion.id,
              mergeState: 'clean',
              createdBy: actorId,
            })
            .returning();

          const [newVersion] = await tx
            .insert(schema.contentVersions)
            .values({
              contentId: newContent.id,
              body: mainVersion.body,
              bodyFormat: mainVersion.bodyFormat,
              metadataSnapshot,
              changeDescription: 'Added from main during rebase',
              authorId: actorId,
              authorType: 'system',
              byteSize: mainVersion.byteSize,
              checksum: mainVersion.checksum,
            })
            .returning();

          await tx
            .update(schema.contents)
            .set({ currentVersionId: newVersion.id })
            .where(eq(schema.contents.id, newContent.id));

          await tx.insert(schema.contentMergeHistory).values({
            contentId: newContent.id,
            operationType: 'rebase',
            sourceBranchId: mainBranch.id,
            targetBranchId: branchId,
            baseVersionId: mainVersion.id,
            sourceVersionId: mainVersion.id,
            resultVersionId: newVersion.id,
            hadConflict: false,
            actorId,
            metadata: { action: 'added_from_main' },
          });
        });

        addedCount++;
      } catch (error) {
        console.error(`Failed to add content ${newItem.slug} during rebase:`, error);
      }
    }

    // Update content that changed in main
    for (const update of preview.updatedInMain.filter((u) => !u.hasConflict)) {
      try {
        const mainItem = await db.query.contents.findFirst({
          where: eq(schema.contents.id, update.contentId),
        });
        if (!mainItem) continue;

        const mainVersion = mainItem.publishedVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, mainItem.publishedVersionId),
            })
          : null;
        if (!mainVersion) continue;

        // Find the branch content for this slug
        const branchItem = await db.query.contents.findFirst({
          where: and(
            eq(schema.contents.branchId, branchId),
            eq(schema.contents.slug, update.slug)
          ),
        });
        if (!branchItem) continue;

        const branchVersion = branchItem.currentVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, branchItem.currentVersionId),
            })
          : null;

        const baseVersion = branchItem.baseVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, branchItem.baseVersionId),
            })
          : null;

        // Determine the new content
        let newBody = mainVersion.body;
        if (branchVersion && baseVersion && branchVersion.checksum !== baseVersion.checksum) {
          // Branch also modified - merge (we know there's no conflict)
          const mergeResult = threeWayMerge(
            baseVersion.body,
            mainVersion.body,
            branchVersion.body
          );
          if (mergeResult.result) {
            newBody = mergeResult.result;
          }
        }

        await db.transaction(async (tx) => {
          const metadataSnapshot = createMetadataSnapshot({
            title: mainItem.title,
            category: mainItem.category ?? undefined,
            tags: mainItem.tags ?? [],
          });

          const [newVersion] = await tx
            .insert(schema.contentVersions)
            .values({
              contentId: branchItem.id,
              parentVersionId: branchItem.currentVersionId,
              body: newBody,
              bodyFormat: mainVersion.bodyFormat,
              metadataSnapshot,
              changeDescription: 'Updated from main during rebase',
              authorId: actorId,
              authorType: 'system',
              byteSize: computeByteSize(newBody),
              checksum: computeChecksum(newBody),
            })
            .returning();

          await tx
            .update(schema.contents)
            .set({
              currentVersionId: newVersion.id,
              baseVersionId: mainVersion.id, // Update base to main's current
              title: mainItem.title,
              category: mainItem.category,
              tags: mainItem.tags,
              description: mainItem.description,
              updatedAt: new Date(),
            })
            .where(eq(schema.contents.id, branchItem.id));

          await tx.insert(schema.contentMergeHistory).values({
            contentId: branchItem.id,
            operationType: 'rebase',
            sourceBranchId: mainBranch.id,
            targetBranchId: branchId,
            baseVersionId: baseVersion?.id,
            sourceVersionId: mainVersion.id,
            resultVersionId: newVersion.id,
            hadConflict: false,
            actorId,
            metadata: { action: 'updated_from_main' },
          });
        });

        updatedCount++;
      } catch (error) {
        console.error(`Failed to update content ${update.slug} during rebase:`, error);
      }
    }

    // Handle deleted content (mark as orphaned but don't delete)
    for (const deleted of preview.deletedInMain) {
      await db
        .update(schema.contents)
        .set({
          sourceContentId: null, // Unlink from main (content was deleted there)
          updatedAt: new Date(),
        })
        .where(eq(schema.contents.id, deleted.branchContentId));
    }

    // Update branch's base commit and create new snapshot
    const newBaseCommit = mainBranch.headCommit;
    await db
      .update(schema.branches)
      .set({
        baseCommit: newBaseCommit,
        updatedAt: new Date(),
      })
      .where(eq(schema.branches.id, branchId));

    // Create new content snapshot
    const branchContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    const manifest: Record<string, any> = {};
    for (const content of branchContent) {
      if (content.currentVersionId) {
        const version = await db.query.contentVersions.findFirst({
          where: eq(schema.contentVersions.id, content.currentVersionId),
        });
        if (version) {
          manifest[content.slug] = {
            contentId: content.id,
            versionId: version.id,
            slug: content.slug,
            checksum: version.checksum,
          };
        }
      }
    }

    await db.insert(schema.contentSnapshots).values({
      branchId,
      commitRef: newBaseCommit,
      contentManifest: manifest,
    });

    return {
      success: true,
      addedCount,
      updatedCount,
      conflictCount: 0,
      conflicts: [],
      newBaseCommit,
    };
  },

  /**
   * Continue a rebase after conflicts have been resolved.
   */
  async continueRebase(branchId: string, actorId: string): Promise<RebaseResult> {
    const rebaseState = rebaseInProgress.get(branchId);
    if (!rebaseState) {
      throw new Error('No rebase in progress for this branch');
    }

    // Check all conflicts are resolved
    const unresolvedCount = rebaseState.conflicts.length - rebaseState.resolvedConflicts.size;
    if (unresolvedCount > 0) {
      throw new Error(`${unresolvedCount} conflict(s) still need to be resolved`);
    }

    // Clear the in-progress state
    rebaseInProgress.delete(branchId);

    // Clear conflict state from all content
    await db
      .update(schema.contents)
      .set({
        mergeState: 'clean',
        conflictData: null,
      })
      .where(eq(schema.contents.branchId, branchId));

    // Now run the rebase again (should succeed since conflicts are resolved)
    return this.rebase(branchId, actorId);
  },

  /**
   * Abort an in-progress rebase.
   */
  async abortRebase(branchId: string): Promise<void> {
    const rebaseState = rebaseInProgress.get(branchId);
    if (!rebaseState) {
      throw new Error('No rebase in progress for this branch');
    }

    // Clear the in-progress state
    rebaseInProgress.delete(branchId);

    // Clear conflict state from all content
    await db
      .update(schema.contents)
      .set({
        mergeState: 'clean',
        conflictData: null,
      })
      .where(eq(schema.contents.branchId, branchId));
  },

  /**
   * Check if a rebase is in progress for a branch.
   */
  isRebaseInProgress(branchId: string): boolean {
    return rebaseInProgress.has(branchId);
  },

  /**
   * Get the current rebase state for a branch.
   */
  getRebaseState(branchId: string) {
    return rebaseInProgress.get(branchId);
  },

  /**
   * Mark a conflict as resolved (called after conflict resolution service handles it).
   */
  markConflictResolved(branchId: string, contentId: string): void {
    const rebaseState = rebaseInProgress.get(branchId);
    if (rebaseState) {
      rebaseState.resolvedConflicts.add(contentId);
    }
  },
};
