import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import {
  computeChecksum,
  computeByteSize,
  createMetadataSnapshot,
} from '../../models/content.js';
import { contentRebaseService } from './content-rebase-service.js';
import type { ContentConflict } from './content-merge-service.js';

export type ResolutionStrategy = 'ours' | 'theirs' | 'manual';

export interface ResolveConflictInput {
  contentId: string;
  resolution: ResolutionStrategy;
  mergedBody?: string; // Required if resolution is 'manual'
  mergedMetadata?: {
    title?: string;
    category?: string | null;
    tags?: string[];
    description?: string | null;
  };
  changeDescription?: string;
}

export interface ResolutionResult {
  success: boolean;
  contentId: string;
  newVersionId?: string;
  error?: string;
}

/**
 * Service for resolving merge/rebase conflicts
 */
export const conflictResolutionService = {
  /**
   * Get all content in conflict state for a branch.
   */
  async getConflicts(branchId: string): Promise<Array<{
    contentId: string;
    slug: string;
    title: string;
    conflictData: ContentConflict | null;
  }>> {
    const conflictedContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    return conflictedContent
      .filter((c) => c.mergeState === 'conflict')
      .map((c) => ({
        contentId: c.id,
        slug: c.slug,
        title: c.title,
        conflictData: c.conflictData as ContentConflict | null,
      }));
  },

  /**
   * Resolve a conflict for a single content item.
   */
  async resolveConflict(
    input: ResolveConflictInput,
    actorId: string
  ): Promise<ResolutionResult> {
    const { contentId, resolution, mergedBody, mergedMetadata, changeDescription } = input;

    // Get the content
    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });

    if (!content) {
      return { success: false, contentId, error: 'Content not found' };
    }

    if (content.mergeState !== 'conflict') {
      return { success: false, contentId, error: 'Content is not in conflict state' };
    }

    const conflictData = content.conflictData as ContentConflict | null;
    if (!conflictData) {
      return { success: false, contentId, error: 'No conflict data found' };
    }

    // Determine the resolved body
    let resolvedBody: string;
    switch (resolution) {
      case 'ours':
        // Use main's version (ours in the conflict context)
        resolvedBody = conflictData.oursVersion.body;
        break;
      case 'theirs':
        // Use branch's version (theirs in the conflict context)
        resolvedBody = conflictData.theirsVersion.body;
        break;
      case 'manual':
        if (!mergedBody) {
          return {
            success: false,
            contentId,
            error: 'Manual resolution requires mergedBody',
          };
        }
        resolvedBody = mergedBody;
        break;
      default:
        return { success: false, contentId, error: 'Invalid resolution strategy' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        // Determine metadata
        const newTitle = mergedMetadata?.title ?? content.title;
        const newCategory = mergedMetadata?.category !== undefined
          ? mergedMetadata.category
          : content.category;
        const newTags = mergedMetadata?.tags ?? content.tags ?? [];
        const newDescription = mergedMetadata?.description !== undefined
          ? mergedMetadata.description
          : content.description;

        const metadataSnapshot = createMetadataSnapshot({
          title: newTitle,
          category: newCategory ?? undefined,
          tags: newTags,
        });

        // Create a new version with the resolved content
        const [newVersion] = await tx
          .insert(schema.contentVersions)
          .values({
            contentId: content.id,
            parentVersionId: content.currentVersionId,
            body: resolvedBody,
            bodyFormat: 'markdown',
            metadataSnapshot,
            changeDescription: changeDescription || `Conflict resolved using ${resolution} strategy`,
            authorId: actorId,
            authorType: 'user',
            byteSize: computeByteSize(resolvedBody),
            checksum: computeChecksum(resolvedBody),
          })
          .returning();

        // Update the content - clear conflict state and update version
        await tx
          .update(schema.contents)
          .set({
            currentVersionId: newVersion.id,
            mergeState: 'resolved',
            conflictData: null,
            title: newTitle,
            category: newCategory,
            tags: newTags,
            description: newDescription,
            updatedAt: new Date(),
          })
          .where(eq(schema.contents.id, content.id));

        // Record in merge history
        await tx.insert(schema.contentMergeHistory).values({
          contentId: content.id,
          operationType: 'merge', // Could be rebase too, but merge covers both
          sourceVersionId: conflictData.theirsVersion.versionId,
          resultVersionId: newVersion.id,
          hadConflict: true,
          conflictResolution: resolution,
          actorId,
          metadata: {
            baseVersionId: conflictData.baseVersion?.versionId,
            oursVersionId: conflictData.oursVersion.versionId,
            resolution,
          },
        });

        return newVersion;
      });

      // If this was part of a rebase, mark the conflict as resolved
      if (contentRebaseService.isRebaseInProgress(content.branchId)) {
        contentRebaseService.markConflictResolved(content.branchId, contentId);
      }

      return {
        success: true,
        contentId,
        newVersionId: result.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, contentId, error: message };
    }
  },

  /**
   * Resolve multiple conflicts at once.
   */
  async resolveMultipleConflicts(
    inputs: ResolveConflictInput[],
    actorId: string
  ): Promise<ResolutionResult[]> {
    const results: ResolutionResult[] = [];

    for (const input of inputs) {
      const result = await this.resolveConflict(input, actorId);
      results.push(result);
    }

    return results;
  },

  /**
   * Check if all conflicts for a branch have been resolved.
   */
  async allConflictsResolved(branchId: string): Promise<boolean> {
    const conflicts = await this.getConflicts(branchId);
    return conflicts.length === 0;
  },

  /**
   * Get a preview of what the content would look like with each resolution strategy.
   */
  async getResolutionPreview(contentId: string): Promise<{
    ours: { body: string; checksum: string } | null;
    theirs: { body: string; checksum: string } | null;
    base: { body: string; checksum: string } | null;
    conflictMarkers: string | null;
  } | null> {
    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });

    if (!content || content.mergeState !== 'conflict') {
      return null;
    }

    const conflictData = content.conflictData as ContentConflict | null;
    if (!conflictData) {
      return null;
    }

    return {
      ours: {
        body: conflictData.oursVersion.body,
        checksum: conflictData.oursVersion.checksum,
      },
      theirs: {
        body: conflictData.theirsVersion.body,
        checksum: conflictData.theirsVersion.checksum,
      },
      base: conflictData.baseVersion
        ? {
            body: conflictData.baseVersion.body,
            checksum: conflictData.baseVersion.checksum,
          }
        : null,
      conflictMarkers: conflictData.conflictMarkers ?? null,
    };
  },
};
