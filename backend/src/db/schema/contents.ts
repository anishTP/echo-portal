import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { contentTypeEnum, contentSectionEnum, visibilityEnum, actorTypeEnum, mergeStateEnum, contentOperationTypeEnum, conflictResolutionEnum } from './enums.js';
import { users } from './users.js';
import { branches } from './branches.js';

// --- Contents ---

export const contents = pgTable(
  'contents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    contentType: contentTypeEnum('content_type').notNull(),
    category: text('category'),
    section: contentSectionEnum('section'),
    tags: text('tags').array().default([]),
    description: text('description'),
    currentVersionId: uuid('current_version_id'),
    visibility: visibilityEnum('visibility').default('private').notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    publishedVersionId: uuid('published_version_id'),
    sourceContentId: uuid('source_content_id'),
    // Fields for three-way merge support
    baseVersionId: uuid('base_version_id'),  // Version at branch creation (for 3-way merge base)
    mergeState: mergeStateEnum('merge_state').default('clean').notNull(),
    conflictData: jsonb('conflict_data'),  // Stores conflict details if in conflict state
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('contents_branch_slug_idx').on(table.branchId, table.slug),
    index('contents_branch_id_idx').on(table.branchId),
    index('contents_content_type_idx').on(table.contentType),
    index('contents_is_published_idx').on(table.isPublished),
    index('contents_created_by_idx').on(table.createdBy),
    index('contents_source_content_id_idx').on(table.sourceContentId),
    index('contents_branch_type_idx').on(table.branchId, table.contentType),
    index('contents_section_idx').on(table.section),
  ]
);

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;

// --- Content Versions ---

export const contentVersions = pgTable(
  'content_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contents.id),
    versionTimestamp: timestamp('version_timestamp', { withTimezone: true }).defaultNow().notNull(),
    parentVersionId: uuid('parent_version_id'),
    body: text('body').notNull(),
    bodyFormat: text('body_format').default('markdown').notNull(),
    metadataSnapshot: jsonb('metadata_snapshot').notNull(),
    changeDescription: text('change_description').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    authorType: actorTypeEnum('author_type').default('user').notNull(),
    byteSize: integer('byte_size').notNull(),
    checksum: text('checksum').notNull(),
    isRevert: boolean('is_revert').default(false).notNull(),
    revertedFromId: uuid('reverted_from_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('cv_content_timestamp_idx').on(table.contentId, table.versionTimestamp),
    index('cv_content_id_idx').on(table.contentId),
    index('cv_version_timestamp_idx').on(table.versionTimestamp),
    index('cv_author_id_idx').on(table.authorId),
  ]
);

export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;

// --- Content References ---

export const contentReferences = pgTable(
  'content_references',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceContentId: uuid('source_content_id')
      .notNull()
      .references(() => contents.id),
    sourceVersionId: uuid('source_version_id')
      .notNull()
      .references(() => contentVersions.id),
    targetContentId: uuid('target_content_id')
      .notNull()
      .references(() => contents.id),
    targetVersionId: uuid('target_version_id').references(() => contentVersions.id),
    referenceType: text('reference_type').default('link').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('cr_version_target_type_idx').on(
      table.sourceVersionId,
      table.targetContentId,
      table.referenceType
    ),
    index('cr_source_content_idx').on(table.sourceContentId),
    index('cr_target_content_idx').on(table.targetContentId),
    index('cr_source_version_idx').on(table.sourceVersionId),
  ]
);

export type ContentReference = typeof contentReferences.$inferSelect;
export type NewContentReference = typeof contentReferences.$inferInsert;

// --- Content Snapshots (for tracking branch creation state) ---

export const contentSnapshots = pgTable(
  'content_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    commitRef: text('commit_ref').notNull(),
    // Manifest maps slug -> {contentId, versionId} at snapshot time
    contentManifest: jsonb('content_manifest').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('cs_branch_id_idx').on(table.branchId),
    index('cs_created_at_idx').on(table.createdAt),
  ]
);

export type ContentSnapshot = typeof contentSnapshots.$inferSelect;
export type NewContentSnapshot = typeof contentSnapshots.$inferInsert;

// --- Content Merge History (audit trail for merge/rebase operations) ---

export const contentMergeHistory = pgTable(
  'content_merge_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id').references(() => contents.id),
    operationType: contentOperationTypeEnum('operation_type').notNull(),
    sourceBranchId: uuid('source_branch_id').references(() => branches.id),
    targetBranchId: uuid('target_branch_id').references(() => branches.id),
    baseVersionId: uuid('base_version_id').references(() => contentVersions.id),
    sourceVersionId: uuid('source_version_id').references(() => contentVersions.id),
    resultVersionId: uuid('result_version_id').references(() => contentVersions.id),
    hadConflict: boolean('had_conflict').default(false).notNull(),
    conflictResolution: conflictResolutionEnum('conflict_resolution'),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    metadata: jsonb('metadata'),  // Additional context about the operation
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('cmh_content_id_idx').on(table.contentId),
    index('cmh_source_branch_idx').on(table.sourceBranchId),
    index('cmh_target_branch_idx').on(table.targetBranchId),
    index('cmh_actor_id_idx').on(table.actorId),
    index('cmh_created_at_idx').on(table.createdAt),
  ]
);

export type ContentMergeHistory = typeof contentMergeHistory.$inferSelect;
export type NewContentMergeHistory = typeof contentMergeHistory.$inferInsert;
