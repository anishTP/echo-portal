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
import { contentTypeEnum, visibilityEnum, actorTypeEnum } from './enums.js';
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
    tags: text('tags').array().default([]),
    description: text('description'),
    currentVersionId: uuid('current_version_id'),
    visibility: visibilityEnum('visibility').default('private').notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    publishedVersionId: uuid('published_version_id'),
    sourceContentId: uuid('source_content_id'),
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
