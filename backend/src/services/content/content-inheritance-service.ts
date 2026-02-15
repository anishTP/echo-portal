import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import {
  computeChecksum,
  computeByteSize,
  createMetadataSnapshot,
} from '../../models/content.js';

export interface InheritanceResult {
  success: boolean;
  inheritedCount: number;
  snapshotId: string;
  inheritedContent: Array<{
    sourceContentId: string;
    newContentId: string;
    slug: string;
  }>;
  errors: string[];
}

export interface ContentManifestEntry {
  contentId: string;
  versionId: string;
  slug: string;
  checksum: string;
}

export type ContentManifest = Record<string, ContentManifestEntry>;

export interface BranchDiffResult {
  branchId: string;
  snapshotId: string | null;
  hasChanges: boolean;
  summary: { added: number; modified: number; deleted: number; total: number };
  changes: Array<{
    slug: string;
    changeType: 'added' | 'modified' | 'deleted';
    contentId?: string;
  }>;
}

/**
 * Service for copying published content when creating a branch
 */
export const contentInheritanceService = {
  /**
   * Inherit (copy) all published content from source branch to target branch.
   * Used when creating a new branch from main.
   *
   * @param sourceBranchId - The branch to copy content from (typically main)
   * @param targetBranchId - The newly created branch to copy content to
   * @param baseCommit - The commit ref at branch creation time
   * @param actorId - The user performing the operation
   */
  async inheritContent(
    sourceBranchId: string,
    targetBranchId: string,
    baseCommit: string,
    actorId: string
  ): Promise<InheritanceResult> {
    const errors: string[] = [];
    const inheritedContent: InheritanceResult['inheritedContent'] = [];
    const manifest: ContentManifest = {};

    // Query all published content from source branch (excluding archived/deleted)
    const publishedContent = await db.query.contents.findMany({
      where: and(
        eq(schema.contents.branchId, sourceBranchId),
        eq(schema.contents.isPublished, true),
        isNull(schema.contents.archivedAt)
      ),
    });

    if (publishedContent.length === 0) {
      // No content to inherit - create empty snapshot
      const [snapshot] = await db
        .insert(schema.contentSnapshots)
        .values({
          branchId: targetBranchId,
          commitRef: baseCommit,
          contentManifest: {},
        })
        .returning();

      return {
        success: true,
        inheritedCount: 0,
        snapshotId: snapshot.id,
        inheritedContent: [],
        errors: [],
      };
    }

    // Copy each piece of published content
    for (const content of publishedContent) {
      try {
        // Get the published version
        const publishedVersion = content.publishedVersionId
          ? await db.query.contentVersions.findFirst({
              where: eq(schema.contentVersions.id, content.publishedVersionId),
            })
          : null;

        if (!publishedVersion) {
          errors.push(`Content ${content.id} has no published version`);
          continue;
        }

        // Create content + version in a transaction
        const result = await db.transaction(async (tx) => {
          // Create new content record in target branch
          const [newContent] = await tx
            .insert(schema.contents)
            .values({
              branchId: targetBranchId,
              slug: content.slug,
              title: content.title,
              contentType: content.contentType,
              section: content.section,
              category: content.category,
              tags: content.tags,
              description: content.description,
              visibility: content.visibility,
              sourceContentId: content.id, // Track where this came from
              baseVersionId: publishedVersion.id, // For 3-way merge base
              mergeState: 'clean',
              createdBy: actorId,
            })
            .returning();

          // Copy the published version as the first version in new content
          const metadataSnapshot = createMetadataSnapshot({
            title: content.title,
            category: content.category ?? undefined,
            tags: content.tags ?? [],
          });

          const [newVersion] = await tx
            .insert(schema.contentVersions)
            .values({
              contentId: newContent.id,
              body: publishedVersion.body,
              bodyFormat: publishedVersion.bodyFormat,
              metadataSnapshot,
              changeDescription: 'Inherited from published content',
              authorId: actorId,
              authorType: 'system',
              byteSize: publishedVersion.byteSize,
              checksum: publishedVersion.checksum,
            })
            .returning();

          // Update content with current version reference
          await tx
            .update(schema.contents)
            .set({ currentVersionId: newVersion.id })
            .where(eq(schema.contents.id, newContent.id));

          // Record in merge history
          await tx.insert(schema.contentMergeHistory).values({
            contentId: newContent.id,
            operationType: 'inherit',
            sourceBranchId,
            targetBranchId,
            baseVersionId: publishedVersion.id,
            sourceVersionId: publishedVersion.id,
            resultVersionId: newVersion.id,
            hadConflict: false,
            actorId,
            metadata: { inheritedFrom: content.id },
          });

          return { newContent, newVersion };
        });

        inheritedContent.push({
          sourceContentId: content.id,
          newContentId: result.newContent.id,
          slug: content.slug,
        });

        // Add to manifest
        manifest[content.slug] = {
          contentId: result.newContent.id,
          versionId: result.newVersion.id,
          slug: content.slug,
          checksum: result.newVersion.checksum,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to inherit content ${content.id}: ${message}`);
      }
    }

    // Create content snapshot recording the state at branch creation
    const [snapshot] = await db
      .insert(schema.contentSnapshots)
      .values({
        branchId: targetBranchId,
        commitRef: baseCommit,
        contentManifest: manifest,
      })
      .returning();

    return {
      success: errors.length === 0,
      inheritedCount: inheritedContent.length,
      snapshotId: snapshot.id,
      inheritedContent,
      errors,
    };
  },

  /**
   * Get the content snapshot for a branch (state at creation time)
   */
  async getSnapshot(branchId: string): Promise<typeof schema.contentSnapshots.$inferSelect | null> {
    const snapshot = await db.query.contentSnapshots.findFirst({
      where: eq(schema.contentSnapshots.branchId, branchId),
    });
    return snapshot ?? null;
  },

  /**
   * Get the content manifest for a branch
   */
  async getManifest(branchId: string): Promise<ContentManifest | null> {
    const snapshot = await this.getSnapshot(branchId);
    if (!snapshot) return null;
    return snapshot.contentManifest as ContentManifest;
  },

  /**
   * Compute the diff between current branch state and its creation snapshot.
   * Detects added, modified, and deleted content.
   */
  async computeBranchDiff(branchId: string): Promise<BranchDiffResult> {
    const snapshot = await this.getSnapshot(branchId);

    // No snapshot = main branch, return no changes
    if (!snapshot) {
      return {
        branchId,
        snapshotId: null,
        hasChanges: false,
        summary: { added: 0, modified: 0, deleted: 0, total: 0 },
        changes: [],
      };
    }

    const snapshotManifest = snapshot.contentManifest as ContentManifest;

    // Get ALL branch content (including archived for deletion detection)
    const allContent = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    // Build maps
    const activeContent = new Map<string, (typeof allContent)[0]>();
    for (const c of allContent) {
      if (!c.archivedAt) {
        activeContent.set(c.slug, c);
      }
    }

    // Get current checksums for active content
    const versionIds = [...activeContent.values()]
      .filter((c) => c.currentVersionId)
      .map((c) => c.currentVersionId!);
    const versions =
      versionIds.length > 0
        ? await db.query.contentVersions.findMany({
            where: inArray(schema.contentVersions.id, versionIds),
          })
        : [];
    const checksums = new Map(versions.map((v) => [v.contentId, v.checksum]));

    const changes: BranchDiffResult['changes'] = [];
    const snapshotSlugs = new Set(Object.keys(snapshotManifest));

    // Deleted: in snapshot but not active
    for (const slug of Object.keys(snapshotManifest)) {
      if (!activeContent.has(slug)) {
        changes.push({ slug, changeType: 'deleted' });
      }
    }

    // Added: active but not in snapshot
    for (const [slug, content] of activeContent) {
      if (!snapshotSlugs.has(slug)) {
        changes.push({ slug, changeType: 'added', contentId: content.id });
      }
    }

    // Modified: in both but different checksum
    for (const [slug, content] of activeContent) {
      const entry = snapshotManifest[slug];
      if (entry && checksums.get(content.id) !== entry.checksum) {
        changes.push({ slug, changeType: 'modified', contentId: content.id });
      }
    }

    return {
      branchId,
      snapshotId: snapshot.id,
      hasChanges: changes.length > 0,
      summary: {
        added: changes.filter((c) => c.changeType === 'added').length,
        modified: changes.filter((c) => c.changeType === 'modified').length,
        deleted: changes.filter((c) => c.changeType === 'deleted').length,
        total: changes.length,
      },
      changes,
    };
  },
};
