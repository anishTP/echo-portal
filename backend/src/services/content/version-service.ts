import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { computeChecksum, computeByteSize, createMetadataSnapshot } from '../../models/content.js';
import type { ContentVersionDetail, ContentVersionSummary, UserSummary } from '@echo-portal/shared';

async function getUserSummary(userId: string): Promise<UserSummary> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  return {
    id: userId,
    displayName: user?.displayName ?? 'Unknown',
    avatarUrl: user?.avatarUrl ?? undefined,
  };
}

function formatVersionDetail(
  version: typeof schema.contentVersions.$inferSelect,
  author: UserSummary
): ContentVersionDetail {
  return {
    id: version.id,
    versionTimestamp: version.versionTimestamp.toISOString(),
    body: version.body,
    bodyFormat: version.bodyFormat,
    metadataSnapshot: version.metadataSnapshot as { title: string; category?: string; tags: string[] },
    changeDescription: version.changeDescription,
    author,
    authorType: version.authorType as 'user' | 'system',
    byteSize: version.byteSize,
    checksum: version.checksum,
    isRevert: version.isRevert,
    revertedFromId: version.revertedFromId ?? undefined,
    createdAt: version.createdAt.toISOString(),
  };
}

function formatVersionSummary(
  version: typeof schema.contentVersions.$inferSelect,
  author: UserSummary
): ContentVersionSummary {
  return {
    id: version.id,
    versionTimestamp: version.versionTimestamp.toISOString(),
    changeDescription: version.changeDescription,
    author,
    authorType: version.authorType as 'user' | 'system',
    byteSize: version.byteSize,
    isRevert: version.isRevert,
    createdAt: version.createdAt.toISOString(),
  };
}

export const versionService = {
  /**
   * Create a new version for content.
   * Handles timestamp collision retry (max 3 attempts).
   */
  async createVersion(
    contentId: string,
    input: {
      body: string;
      bodyFormat?: string;
      metadataSnapshot: { title: string; category?: string; tags: string[] };
      changeDescription: string;
      parentVersionId?: string | null;
      isRevert?: boolean;
      revertedFromId?: string | null;
    },
    actor: { userId: string; authorType?: 'user' | 'system' }
  ): Promise<ContentVersionDetail> {
    const byteSize = computeByteSize(input.body);
    const checksum = computeChecksum(input.body);

    let attempts = 0;
    const maxRetries = 3;
    let timestamp = new Date();

    while (attempts < maxRetries) {
      try {
        const [version] = await db
          .insert(schema.contentVersions)
          .values({
            contentId,
            versionTimestamp: timestamp,
            parentVersionId: input.parentVersionId ?? undefined,
            body: input.body,
            bodyFormat: input.bodyFormat ?? 'markdown',
            metadataSnapshot: input.metadataSnapshot,
            changeDescription: input.changeDescription,
            authorId: actor.userId,
            authorType: actor.authorType ?? 'user',
            byteSize,
            checksum,
            isRevert: input.isRevert ?? false,
            revertedFromId: input.revertedFromId ?? undefined,
          })
          .returning();

        const authorSummary = await getUserSummary(actor.userId);
        return formatVersionDetail(version, authorSummary);
      } catch (error: unknown) {
        const dbError = error as { code?: string };
        // Unique constraint violation (timestamp collision)
        if (dbError.code === '23505') {
          attempts++;
          timestamp = new Date(timestamp.getTime() + 1);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to create version after timestamp collision retries');
  },

  /**
   * Get paginated version history for content.
   */
  async getVersions(
    contentId: string,
    options: { page?: number; limit?: number }
  ): Promise<{ items: ContentVersionSummary[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = (page - 1) * limit;

    const whereClause = eq(schema.contentVersions.contentId, contentId);

    const [versions, countResult] = await Promise.all([
      db.query.contentVersions.findMany({
        where: whereClause,
        orderBy: [desc(schema.contentVersions.versionTimestamp)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.contentVersions)
        .where(whereClause),
    ]);

    const summaries = await Promise.all(
      versions.map(async (v) => {
        const author = await getUserSummary(v.authorId);
        return formatVersionSummary(v, author);
      })
    );

    return { items: summaries, total: Number(countResult[0]?.count ?? 0) };
  },

  /**
   * Get a specific version by UUID.
   */
  async getVersion(contentId: string, versionId: string): Promise<ContentVersionDetail | null> {
    const version = await db.query.contentVersions.findFirst({
      where: and(
        eq(schema.contentVersions.contentId, contentId),
        eq(schema.contentVersions.id, versionId)
      ),
    });
    if (!version) return null;

    const author = await getUserSummary(version.authorId);
    return formatVersionDetail(version, author);
  },

  /**
   * Revert content to a previous version.
   * Creates a NEW version with body copied from the target.
   */
  async revert(
    contentId: string,
    targetVersionTimestamp: string,
    changeDescription: string,
    actor: { userId: string; authorType?: 'user' | 'system' }
  ): Promise<ContentVersionDetail> {
    // Find the target version
    const targetVersion = await db.query.contentVersions.findFirst({
      where: and(
        eq(schema.contentVersions.contentId, contentId),
        eq(schema.contentVersions.versionTimestamp, new Date(targetVersionTimestamp))
      ),
    });
    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    // Get current content for parent version reference
    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });
    if (!content) {
      throw new Error('Content not found');
    }

    // Create new version with body from target
    const newVersion = await this.createVersion(
      contentId,
      {
        body: targetVersion.body,
        bodyFormat: targetVersion.bodyFormat,
        metadataSnapshot: targetVersion.metadataSnapshot as { title: string; category?: string; tags: string[] },
        changeDescription,
        parentVersionId: content.currentVersionId,
        isRevert: true,
        revertedFromId: targetVersion.id,
      },
      actor
    );

    // Update content's current version
    await db
      .update(schema.contents)
      .set({
        currentVersionId: newVersion.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.contents.id, contentId));

    return newVersion;
  },
};
