# Data Model: Content Authoring and Versioning

**Branch**: `003-content-authoring-versioning` | **Date**: 2026-01-27

## Overview

This document defines the data model for the Content Authoring and Versioning feature, including entity schemas, relationships, validation rules, and immutability constraints. All new tables are additive to the existing schema; no existing tables are modified.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐         ┌──────────────┐         ┌───────────────┐               │
│  │   User   │────────►│    Branch    │◄────────│    Review     │               │
│  │ (exists) │ owns    │  (exists)    │ reviews │   (exists)    │               │
│  └────┬─────┘         └──────┬───────┘         └───────────────┘               │
│       │                      │                                                  │
│       │ authors              │ contains                                         │
│       ▼                      ▼                                                  │
│  ┌──────────────┐     ┌──────────────┐                                         │
│  │   Content    │◄────│   Content    │                                         │
│  │   Versions   │     │   (NEW)      │──────── self-ref: source_content_id     │
│  │   (NEW)      │     └──────┬───────┘                                         │
│  └──────┬───────┘            │                                                  │
│         │                    │ has_notifications                                │
│         │ references         ▼                                                  │
│         ▼              ┌──────────────┐         ┌───────────────┐              │
│  ┌──────────────┐      │ Notification │         │   AuditLog    │              │
│  │   Content    │      │   (NEW)      │         │   (exists)    │              │
│  │  References  │      └──────────────┘         └───────────────┘              │
│  │   (NEW)      │                                                               │
│  └──────────────┘                                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## New Enums

### content_type_enum

```sql
CREATE TYPE "public"."content_type" AS ENUM('guideline', 'asset', 'opinion');
```

- **guideline**: Design standards, patterns, and best practices documentation
- **asset**: Design tokens, component specifications, image/icon references
- **opinion**: Cultural contributions and design philosophy statements

---

## Core Entities

### 1. Content

Represents a design guideline, asset, or cultural contribution within a branch.

```typescript
interface Content {
  // Identity
  id: string;                       // UUID (PK)
  branchId: string;                 // FK → branches.id (NOT NULL)
  slug: string;                     // URL-safe identifier, UNIQUE per branch

  // Metadata
  title: string;                    // Display name (1-500 chars)
  contentType: ContentType;         // 'guideline' | 'asset' | 'opinion'
  category: string | null;          // Organizational category
  tags: string[];                   // Searchable tags (default: [])
  description: string | null;       // Brief description

  // Versioning
  currentVersionId: string | null;  // FK → content_versions.id
  visibility: Visibility;           // 'private' | 'team' | 'public' (default: 'private')

  // Publication
  isPublished: boolean;             // Locked flag (default: false)
  publishedAt: Date | null;         // When published
  publishedBy: string | null;       // FK → users.id
  publishedVersionId: string | null; // FK → content_versions.id (frozen at publish time)

  // Lineage
  sourceContentId: string | null;   // FK → contents.id (self-ref for update lineage)

  // Audit
  createdBy: string;                // FK → users.id
  createdAt: Date;                  // ISO 8601
  updatedAt: Date;                  // ISO 8601
  archivedAt: Date | null;          // Set on archival
}
```

**Database Schema (Drizzle)**:

```typescript
export const contents = pgTable('contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  contentType: contentTypeEnum('content_type').notNull(),
  category: text('category'),
  tags: text('tags').array().default([]),
  description: text('description'),
  currentVersionId: uuid('current_version_id'),
  visibility: visibilityEnum('visibility').default('private'),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by').references(() => users.id),
  publishedVersionId: uuid('published_version_id'),
  sourceContentId: uuid('source_content_id'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('contents_branch_slug_idx').on(table.branchId, table.slug),
  index('contents_branch_id_idx').on(table.branchId),
  index('contents_content_type_idx').on(table.contentType),
  index('contents_is_published_idx').on(table.isPublished),
  index('contents_created_by_idx').on(table.createdBy),
  index('contents_source_content_id_idx').on(table.sourceContentId),
  index('contents_branch_type_idx').on(table.branchId, table.contentType),
]);
```

**Validation Rules**:
- `title`: Required, 1-500 characters
- `slug`: Auto-generated from title, URL-safe, unique within branch
- `contentType`: Required, must be valid enum value
- `branchId`: Required, must reference existing branch
- `tags`: Each tag 1-100 characters, maximum 20 tags
- `category`: Optional, 1-200 characters if provided
- `description`: Optional, 1-5000 characters if provided

**Constraints**:
- `UNIQUE(branch_id, slug)`: No duplicate slugs within a branch
- `is_published` can only transition from `false` to `true` (never back; archival is separate)
- `source_content_id` creates a lineage chain from new versions back to the original published content

---

### 2. Content Version

Immutable snapshot of content state at a point in time.

```typescript
interface ContentVersion {
  // Identity
  id: string;                       // UUID (PK)
  contentId: string;                // FK → contents.id (NOT NULL)
  versionTimestamp: Date;           // ISO 8601 - serves as version identifier

  // Lineage
  parentVersionId: string | null;   // FK → content_versions.id

  // Content
  body: string;                     // Full content body (markdown/structured text)
  bodyFormat: string;               // 'markdown' | 'structured' | 'rich_text' (default: 'markdown')
  metadataSnapshot: object;         // Frozen copy of title, category, tags at this version
  changeDescription: string;        // What changed and why (1-2000 chars)

  // Attribution
  authorId: string;                 // FK → users.id
  authorType: ActorType;            // 'user' | 'system' (AI attribution)

  // Integrity
  byteSize: number;                 // Content body size in bytes (max 52,428,800)
  checksum: string;                 // SHA-256 hash of body

  // Revert tracking
  isRevert: boolean;                // True if created via revert action
  revertedFromId: string | null;    // FK → content_versions.id (source of revert)

  // Timestamp
  createdAt: Date;                  // ISO 8601
}
```

**Database Schema (Drizzle)**:

```typescript
export const contentVersions = pgTable('content_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull().references(() => contents.id),
  versionTimestamp: timestamp('version_timestamp', { withTimezone: true }).defaultNow().notNull(),
  parentVersionId: uuid('parent_version_id'),
  body: text('body').notNull(),
  bodyFormat: text('body_format').default('markdown').notNull(),
  metadataSnapshot: jsonb('metadata_snapshot').notNull(),
  changeDescription: text('change_description').notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  authorType: actorTypeEnum('author_type').default('user').notNull(),
  byteSize: integer('byte_size').notNull(),
  checksum: text('checksum').notNull(),
  isRevert: boolean('is_revert').default(false).notNull(),
  revertedFromId: uuid('reverted_from_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('cv_content_timestamp_idx').on(table.contentId, table.versionTimestamp),
  index('cv_content_id_idx').on(table.contentId),
  index('cv_version_timestamp_idx').on(table.versionTimestamp),
  index('cv_author_id_idx').on(table.authorId),
  index('cv_content_timestamp_desc_idx').on(table.contentId, table.versionTimestamp),
]);
```

**Validation Rules**:
- `body`: Required, byte size <= 52,428,800 (50 MB)
- `changeDescription`: Required, 1-2000 characters
- `bodyFormat`: Must be one of 'markdown', 'structured', 'rich_text'
- `metadataSnapshot`: Required, JSONB object containing at minimum { title, category, tags }
- `checksum`: SHA-256 hash of `body` content, computed server-side
- `byteSize`: Computed from `Buffer.byteLength(body, 'utf8')`

**Immutability Constraints**:
- **No UPDATE operations**: Service layer does not expose any method to modify an existing version row.
- **No DELETE operations**: No API endpoint or service method deletes versions.
- **Database trigger**: A `BEFORE UPDATE OR DELETE ON content_versions` trigger raises an exception if the parent content's `is_published = true`, providing a hard safety net.

---

### 3. Content Reference

Tracks cross-content references for integrity and lineage.

```typescript
interface ContentReference {
  id: string;                       // UUID (PK)
  sourceContentId: string;          // FK → contents.id
  sourceVersionId: string;          // FK → content_versions.id
  targetContentId: string;          // FK → contents.id
  targetVersionId: string | null;   // FK → content_versions.id (null = latest)
  referenceType: string;            // 'link' | 'embed' | 'extends' | 'replaces'
  createdAt: Date;                  // ISO 8601
}
```

**Database Schema (Drizzle)**:

```typescript
export const contentReferences = pgTable('content_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceContentId: uuid('source_content_id').notNull().references(() => contents.id),
  sourceVersionId: uuid('source_version_id').notNull().references(() => contentVersions.id),
  targetContentId: uuid('target_content_id').notNull().references(() => contents.id),
  targetVersionId: uuid('target_version_id').references(() => contentVersions.id),
  referenceType: text('reference_type').default('link').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('cr_version_target_type_idx').on(
    table.sourceVersionId, table.targetContentId, table.referenceType
  ),
  index('cr_source_content_idx').on(table.sourceContentId),
  index('cr_target_content_idx').on(table.targetContentId),
  index('cr_source_version_idx').on(table.sourceVersionId),
]);
```

**Reference Types**:
- **link**: Simple hyperlink reference to another content item
- **embed**: Content is embedded/included in the source
- **extends**: Source content extends or builds upon target
- **replaces**: Source content supersedes target (used during content updates)

---

### 4. Notification

In-app notifications for review and publication events.

```typescript
interface Notification {
  id: string;                       // UUID (PK)
  userId: string;                   // FK → users.id
  type: string;                     // 'review_requested' | 'review_completed' | 'changes_requested' | 'content_published'
  title: string;                    // Short summary
  message: string;                  // Full notification text
  resourceType: string | null;      // 'content' | 'branch' | 'review'
  resourceId: string | null;        // UUID of the relevant resource
  isRead: boolean;                  // Default: false
  createdAt: Date;                  // ISO 8601
  readAt: Date | null;              // When marked as read
}
```

**Database Schema (Drizzle)**:

```typescript
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_user_read_idx').on(table.userId, table.isRead),
  index('notifications_created_at_idx').on(table.createdAt),
]);
```

---

## Relationships Summary

| From | To | Cardinality | FK Column | Cascade |
|------|----|-------------|-----------|---------|
| contents | branches | Many:1 | `contents.branch_id` | No action |
| contents | users | Many:1 | `contents.created_by` | No action |
| contents | users | Many:1 | `contents.published_by` | No action |
| contents | contents | Many:1 | `contents.source_content_id` | No action (self-ref) |
| contents | content_versions | 1:1 | `contents.current_version_id` | No action |
| contents | content_versions | 1:1 | `contents.published_version_id` | No action |
| content_versions | contents | Many:1 | `content_versions.content_id` | No action |
| content_versions | users | Many:1 | `content_versions.author_id` | No action |
| content_versions | content_versions | Many:1 | `content_versions.parent_version_id` | No action (self-ref) |
| content_versions | content_versions | Many:1 | `content_versions.reverted_from_id` | No action (self-ref) |
| content_references | contents | Many:1 | `content_references.source_content_id` | No action |
| content_references | contents | Many:1 | `content_references.target_content_id` | No action |
| content_references | content_versions | Many:1 | `content_references.source_version_id` | No action |
| content_references | content_versions | Many:1 | `content_references.target_version_id` | No action |
| notifications | users | Many:1 | `notifications.user_id` | No action |

---

## Migration Strategy

All changes are additive. No existing tables or columns are modified.

1. Create `content_type` enum
2. Create `contents` table with all columns and indexes
3. Create `content_versions` table with all columns and indexes
4. Create `content_references` table with all columns and indexes
5. Create `notifications` table with all columns and indexes
6. Add foreign key from `contents.current_version_id` → `content_versions.id` (deferred, since both tables reference each other)
7. Add foreign key from `contents.published_version_id` → `content_versions.id`
8. Create immutability trigger on `content_versions`

Migration generated via `pnpm db:generate` and applied via `pnpm db:push`.

---

## Query Patterns

### High-frequency queries (optimized with indexes)

| Query | Indexes Used | Expected Performance |
|-------|-------------|---------------------|
| List content in branch | `contents_branch_id_idx` | < 50ms for 100 items |
| Get version history (paginated) | `cv_content_timestamp_desc_idx` | < 100ms for 50 items |
| Get specific version | `cv_content_timestamp_idx` (unique) | < 10ms |
| Search published content | `contents_is_published_idx` + full-text | < 500ms for 10,000 items |
| Get unread notification count | `notifications_user_read_idx` | < 10ms |
| Get content references | `cr_source_content_idx` | < 50ms |

### Write patterns

| Operation | Tables Affected | Transaction Required |
|-----------|----------------|---------------------|
| Create content | `contents` + `content_versions` | Yes (single transaction) |
| Update content | `content_versions` + update `contents.current_version_id` | Yes (single transaction) |
| Publish content | Update `contents.is_published`, `published_at`, `published_by`, `published_version_id` | Yes |
| Revert version | `content_versions` + update `contents.current_version_id` | Yes (single transaction) |
| Record reference | `content_references` | No (single insert) |
| Send notification | `notifications` | No (single insert) |
