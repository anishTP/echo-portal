import { eq, and, desc, sql, ilike, or, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { generateContentSlug, computeChecksum, computeByteSize, createMetadataSnapshot, MAX_CONTENT_BYTE_SIZE } from '../../models/content.js';
import type { ContentDetail, ContentSummary, UserSummary } from '@echo-portal/shared';

interface DraftSyncResultInternal {
  success: boolean;
  newVersionTimestamp?: string;
  conflict?: {
    serverVersionTimestamp: string;
    serverVersionAuthor: UserSummary;
    serverBody: string;
  };
}

export interface CreateContentInput {
  branchId: string;
  title: string;
  contentType: 'guideline' | 'asset' | 'opinion';
  category?: string;
  tags?: string[];
  description?: string;
  body: string;
  bodyFormat?: string;
  changeDescription: string;
}

export interface UpdateContentInput {
  title?: string;
  category?: string | null;
  tags?: string[];
  description?: string | null;
  body: string;
  bodyFormat?: string;
  changeDescription: string;
  currentVersionTimestamp?: string;
}

export interface DraftSyncInput {
  branchId: string;
  title?: string;
  body: string;
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
  };
  expectedServerVersion: string | null;
  changeDescription: string;
}

interface ActorContext {
  userId: string;
  authorType?: 'user' | 'system';
}

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

function formatContentResponse(
  content: typeof schema.contents.$inferSelect,
  version: typeof schema.contentVersions.$inferSelect | null,
  author: UserSummary | null,
  createdByUser: UserSummary
): ContentDetail {
  return {
    id: content.id,
    branchId: content.branchId,
    title: content.title,
    slug: content.slug,
    contentType: content.contentType as 'guideline' | 'asset' | 'opinion',
    category: content.category ?? undefined,
    tags: content.tags ?? [],
    description: content.description ?? undefined,
    visibility: content.visibility as 'private' | 'team' | 'public',
    isPublished: content.isPublished,
    publishedAt: content.publishedAt?.toISOString(),
    sourceContentId: content.sourceContentId ?? undefined,
    createdBy: createdByUser,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
    currentVersion: version
      ? {
          id: version.id,
          versionTimestamp: version.versionTimestamp.toISOString(),
          body: version.body,
          bodyFormat: version.bodyFormat,
          metadataSnapshot: version.metadataSnapshot as { title: string; category?: string; tags: string[] },
          changeDescription: version.changeDescription,
          author: author ?? { id: version.authorId, displayName: 'Unknown' },
          authorType: version.authorType as 'user' | 'system',
          byteSize: version.byteSize,
          checksum: version.checksum,
          isRevert: version.isRevert,
          revertedFromId: version.revertedFromId ?? undefined,
          createdAt: version.createdAt.toISOString(),
        }
      : {
          id: '',
          versionTimestamp: '',
          body: '',
          bodyFormat: 'markdown',
          metadataSnapshot: { title: content.title, tags: [] },
          changeDescription: '',
          author: createdByUser,
          authorType: 'user' as const,
          byteSize: 0,
          checksum: '',
          isRevert: false,
          createdAt: content.createdAt.toISOString(),
        },
  };
}

function formatContentSummary(
  content: typeof schema.contents.$inferSelect,
  createdByUser: UserSummary
): ContentSummary {
  return {
    id: content.id,
    branchId: content.branchId,
    title: content.title,
    slug: content.slug,
    contentType: content.contentType as 'guideline' | 'asset' | 'opinion',
    category: content.category ?? undefined,
    tags: content.tags ?? [],
    description: content.description ?? undefined,
    visibility: content.visibility as 'private' | 'team' | 'public',
    isPublished: content.isPublished,
    publishedAt: content.publishedAt?.toISOString(),
    sourceContentId: content.sourceContentId ?? undefined,
    createdBy: createdByUser,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
  };
}

export const contentService = {
  /**
   * Create new content within a branch with an initial version.
   */
  async create(input: CreateContentInput, actor: ActorContext): Promise<ContentDetail> {
    const byteSize = computeByteSize(input.body);
    if (byteSize > MAX_CONTENT_BYTE_SIZE) {
      throw new Error('Content body exceeds 50 MB size limit');
    }

    // Validate branch exists and is in draft state
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, input.branchId),
    });
    if (!branch) {
      throw new Error('Branch not found');
    }
    if (branch.state !== 'draft') {
      throw new Error('Content can only be created in draft branches');
    }

    // Generate a unique slug, handling conflicts with existing (including archived) content
    const baseSlug = generateContentSlug(input.title);
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await db.query.contents.findFirst({
        where: and(
          eq(schema.contents.branchId, input.branchId),
          eq(schema.contents.slug, slug)
        ),
      });
      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > 100) {
        throw new Error('Unable to generate unique slug');
      }
    }

    const checksum = computeChecksum(input.body);
    const tags = input.tags ?? [];
    const metadataSnapshot = createMetadataSnapshot({
      title: input.title,
      category: input.category,
      tags,
    });

    // Create content + initial version in a transaction
    const result = await db.transaction(async (tx) => {
      const [content] = await tx
        .insert(schema.contents)
        .values({
          branchId: input.branchId,
          slug,
          title: input.title,
          contentType: input.contentType,
          category: input.category,
          tags,
          description: input.description,
          visibility: branch.visibility,
          createdBy: actor.userId,
        })
        .returning();

      const [version] = await tx
        .insert(schema.contentVersions)
        .values({
          contentId: content.id,
          body: input.body,
          bodyFormat: input.bodyFormat ?? 'markdown',
          metadataSnapshot,
          changeDescription: input.changeDescription,
          authorId: actor.userId,
          authorType: actor.authorType ?? 'user',
          byteSize,
          checksum,
        })
        .returning();

      // Update content with current version reference
      await tx
        .update(schema.contents)
        .set({ currentVersionId: version.id })
        .where(eq(schema.contents.id, content.id));

      return { content: { ...content, currentVersionId: version.id }, version };
    });

    const authorSummary = await getUserSummary(actor.userId);
    return formatContentResponse(result.content, result.version, authorSummary, authorSummary);
  },

  /**
   * Update content by creating a new version.
   */
  async update(
    contentId: string,
    input: UpdateContentInput,
    actor: ActorContext
  ): Promise<ContentDetail> {
    const byteSize = computeByteSize(input.body);
    if (byteSize > MAX_CONTENT_BYTE_SIZE) {
      throw new Error('Content body exceeds 50 MB size limit');
    }

    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });
    if (!content) {
      throw new Error('Content not found');
    }
    if (content.isPublished) {
      throw new Error('Published content cannot be modified');
    }

    // Validate branch state
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, content.branchId),
    });
    if (!branch || branch.state !== 'draft') {
      throw new Error('Content can only be modified in draft branches');
    }

    // Optimistic concurrency check
    if (input.currentVersionTimestamp && content.currentVersionId) {
      const currentVersion = await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, content.currentVersionId),
      });
      if (
        currentVersion &&
        currentVersion.versionTimestamp.toISOString() !== input.currentVersionTimestamp
      ) {
        throw Object.assign(new Error('Version conflict: content was modified by another user'), {
          code: 'VERSION_CONFLICT',
          currentVersion,
        });
      }
    }

    const checksum = computeChecksum(input.body);
    const updatedTitle = input.title ?? content.title;
    const updatedCategory = input.category !== undefined ? input.category : content.category;
    const updatedTags = input.tags ?? content.tags ?? [];
    const metadataSnapshot = createMetadataSnapshot({
      title: updatedTitle,
      category: updatedCategory,
      tags: updatedTags,
    });

    const result = await db.transaction(async (tx) => {
      const [version] = await tx
        .insert(schema.contentVersions)
        .values({
          contentId: content.id,
          parentVersionId: content.currentVersionId,
          body: input.body,
          bodyFormat: input.bodyFormat ?? 'markdown',
          metadataSnapshot,
          changeDescription: input.changeDescription,
          authorId: actor.userId,
          authorType: actor.authorType ?? 'user',
          byteSize,
          checksum,
        })
        .returning();

      const [updatedContent] = await tx
        .update(schema.contents)
        .set({
          currentVersionId: version.id,
          title: updatedTitle,
          category: updatedCategory,
          tags: updatedTags,
          description: input.description !== undefined ? input.description : content.description,
          updatedAt: new Date(),
        })
        .where(eq(schema.contents.id, content.id))
        .returning();

      return { content: updatedContent, version };
    });

    const authorSummary = await getUserSummary(actor.userId);
    const createdBySummary = await getUserSummary(result.content.createdBy);
    return formatContentResponse(result.content, result.version, authorSummary, createdBySummary);
  },

  /**
   * Get content by ID with current version.
   */
  async getById(contentId: string): Promise<ContentDetail | null> {
    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });
    if (!content) return null;

    let version = null;
    let authorSummary = null;
    if (content.currentVersionId) {
      version = await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, content.currentVersionId),
      });
      if (version) {
        authorSummary = await getUserSummary(version.authorId);
      }
    }

    const createdBySummary = await getUserSummary(content.createdBy);
    return formatContentResponse(content, version ?? null, authorSummary, createdBySummary);
  },

  /**
   * List content in a branch (excludes body for performance).
   */
  async listByBranch(
    branchId: string,
    options: { contentType?: string; category?: string; page?: number; limit?: number }
  ): Promise<{ items: ContentSummary[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.contents.branchId, branchId),
      isNull(schema.contents.archivedAt),
    ];
    if (options.contentType) {
      conditions.push(eq(schema.contents.contentType, options.contentType as 'guideline' | 'asset' | 'opinion'));
    }
    if (options.category) {
      conditions.push(eq(schema.contents.category, options.category));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.contents.findMany({
        where: whereClause,
        orderBy: [desc(schema.contents.updatedAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(schema.contents).where(whereClause!),
    ]);

    const summaries = await Promise.all(
      items.map(async (item) => {
        const createdBy = await getUserSummary(item.createdBy);
        return formatContentSummary(item, createdBy);
      })
    );

    return { items: summaries, total: Number(countResult[0]?.count ?? 0) };
  },

  /**
   * List published public content.
   */
  async listPublished(options: {
    contentType?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ContentSummary[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.contents.isPublished, true),
      eq(schema.contents.visibility, 'public'),
      isNull(schema.contents.archivedAt),
    ];
    if (options.contentType) {
      conditions.push(eq(schema.contents.contentType, options.contentType as 'guideline' | 'asset' | 'opinion'));
    }
    if (options.category) {
      conditions.push(eq(schema.contents.category, options.category));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.contents.findMany({
        where: whereClause,
        orderBy: [desc(schema.contents.publishedAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(schema.contents).where(whereClause!),
    ]);

    const summaries = await Promise.all(
      items.map(async (item) => {
        const createdBy = await getUserSummary(item.createdBy);
        return formatContentSummary(item, createdBy);
      })
    );

    return { items: summaries, total: Number(countResult[0]?.count ?? 0) };
  },

  /**
   * Search content by title, description, tags, category.
   */
  async search(
    query: string,
    options: { contentType?: string; page?: number; limit?: number }
  ): Promise<{ items: ContentSummary[]; total: number }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const conditions = [
      isNull(schema.contents.archivedAt),
      or(
        ilike(schema.contents.title, searchPattern),
        ilike(schema.contents.description, searchPattern),
        ilike(schema.contents.category, searchPattern)
      ),
    ];
    if (options.contentType) {
      conditions.push(eq(schema.contents.contentType, options.contentType as 'guideline' | 'asset' | 'opinion'));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.contents.findMany({
        where: whereClause,
        orderBy: [desc(schema.contents.updatedAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(schema.contents).where(whereClause!),
    ]);

    const summaries = await Promise.all(
      items.map(async (item) => {
        const createdBy = await getUserSummary(item.createdBy);
        return formatContentSummary(item, createdBy);
      })
    );

    return { items: summaries, total: Number(countResult[0]?.count ?? 0) };
  },

  /**
   * Mark all content in a branch as published.
   */
  async markPublished(branchId: string, publishedBy: string): Promise<void> {
    const branchContents = await db.query.contents.findMany({
      where: eq(schema.contents.branchId, branchId),
    });

    for (const content of branchContents) {
      await db
        .update(schema.contents)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          publishedBy,
          publishedVersionId: content.currentVersionId,
        })
        .where(eq(schema.contents.id, content.id));
    }
  },

  /**
   * Mark all content in a branch as archived.
   */
  async markArchived(branchId: string): Promise<void> {
    await db
      .update(schema.contents)
      .set({ archivedAt: new Date() })
      .where(eq(schema.contents.branchId, branchId));
  },

  /**
   * Delete (archive) content by ID.
   * Soft delete: sets archivedAt timestamp.
   */
  async delete(contentId: string): Promise<void> {
    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });
    if (!content) {
      throw new Error('Content not found');
    }
    if (content.isPublished) {
      throw new Error('Published content cannot be deleted');
    }

    // Validate branch state
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, content.branchId),
    });
    if (!branch || branch.state !== 'draft') {
      throw new Error('Content can only be deleted in draft branches');
    }

    await db
      .update(schema.contents)
      .set({ archivedAt: new Date() })
      .where(eq(schema.contents.id, contentId));
  },

  /**
   * Get published content by slug.
   */
  async getPublishedBySlug(slug: string): Promise<ContentDetail | null> {
    const content = await db.query.contents.findFirst({
      where: and(
        eq(schema.contents.slug, slug),
        eq(schema.contents.isPublished, true),
        eq(schema.contents.visibility, 'public')
      ),
    });
    if (!content) return null;

    let version = null;
    let authorSummary = null;
    if (content.currentVersionId) {
      version = await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, content.currentVersionId),
      });
      if (version) {
        authorSummary = await getUserSummary(version.authorId);
      }
    }

    const createdBySummary = await getUserSummary(content.createdBy);
    return formatContentResponse(content, version ?? null, authorSummary, createdBySummary);
  },

  /**
   * Get published content by ID.
   */
  async getPublishedById(contentId: string): Promise<ContentDetail | null> {
    const content = await db.query.contents.findFirst({
      where: and(
        eq(schema.contents.id, contentId),
        eq(schema.contents.isPublished, true)
      ),
    });
    if (!content) return null;

    let version = null;
    let authorSummary = null;
    if (content.currentVersionId) {
      version = await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, content.currentVersionId),
      });
      if (version) {
        authorSummary = await getUserSummary(version.authorId);
      }
    }

    const createdBySummary = await getUserSummary(content.createdBy);
    return formatContentResponse(content, version ?? null, authorSummary, createdBySummary);
  },

  /**
   * Sync draft changes from client with conflict detection.
   * Used by auto-save and manual save operations.
   */
  async syncDraft(
    contentId: string,
    input: DraftSyncInput,
    actor: ActorContext
  ): Promise<DraftSyncResultInternal> {
    const byteSize = computeByteSize(input.body);
    if (byteSize > MAX_CONTENT_BYTE_SIZE) {
      throw new Error('Content body exceeds 50 MB size limit');
    }

    const content = await db.query.contents.findFirst({
      where: eq(schema.contents.id, contentId),
    });
    if (!content) {
      throw new Error('Content not found');
    }
    if (content.isPublished) {
      throw new Error('Published content cannot be modified');
    }

    // Validate branch state
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, content.branchId),
    });
    if (!branch || branch.state !== 'draft') {
      throw new Error('Content can only be modified in draft branches');
    }

    // Conflict detection: check if server version matches expected
    let currentVersion = null;
    if (content.currentVersionId) {
      currentVersion = await db.query.contentVersions.findFirst({
        where: eq(schema.contentVersions.id, content.currentVersionId),
      });
    }

    if (input.expectedServerVersion !== null && currentVersion) {
      const currentTimestamp = currentVersion.versionTimestamp.toISOString();
      if (currentTimestamp !== input.expectedServerVersion) {
        // Conflict detected - return server state for merge UI
        const serverAuthor = await getUserSummary(currentVersion.authorId);
        return {
          success: false,
          conflict: {
            serverVersionTimestamp: currentTimestamp,
            serverVersionAuthor: serverAuthor,
            serverBody: currentVersion.body,
          },
        };
      }
    }

    // No conflict - create new version
    const checksum = computeChecksum(input.body);
    const updatedTitle = input.title ?? content.title;
    const updatedCategory = input.metadata?.category !== undefined ? input.metadata.category : content.category;
    const updatedTags = input.metadata?.tags ?? content.tags ?? [];
    const metadataSnapshot = createMetadataSnapshot({
      title: updatedTitle,
      category: updatedCategory,
      tags: updatedTags,
    });

    const result = await db.transaction(async (tx) => {
      const [version] = await tx
        .insert(schema.contentVersions)
        .values({
          contentId: content.id,
          parentVersionId: content.currentVersionId,
          body: input.body,
          bodyFormat: 'markdown',
          metadataSnapshot,
          changeDescription: input.changeDescription,
          authorId: actor.userId,
          authorType: actor.authorType ?? 'user',
          byteSize,
          checksum,
        })
        .returning();

      await tx
        .update(schema.contents)
        .set({
          currentVersionId: version.id,
          title: updatedTitle,
          category: updatedCategory,
          tags: updatedTags,
          description: input.metadata?.description !== undefined ? input.metadata.description : content.description,
          updatedAt: new Date(),
        })
        .where(eq(schema.contents.id, content.id));

      return version;
    });

    return {
      success: true,
      newVersionTimestamp: result.versionTimestamp.toISOString(),
    };
  },
};
