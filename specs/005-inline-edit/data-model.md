# Data Model: Inline Edit from Library

**Feature Branch**: `005-inline-edit`
**Date**: 2026-01-31
**Status**: Complete

## Overview

This document defines the data models for client-side draft storage (IndexedDB) and the sync protocol between client and server. The existing PostgreSQL schema for `contents` and `contentVersions` remains unchanged.

---

## 1. Client-Side Schema (IndexedDB via Dexie.js)

### Database: `EchoPortalDrafts`

#### Table: `drafts`

Stores work-in-progress content before server sync.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string | Primary | Composite key: `{contentId}:{branchId}` |
| `contentId` | string | Yes | Content UUID |
| `branchId` | string | Yes | Branch UUID |
| `title` | string | No | Current title |
| `body` | string | No | GFM markdown content |
| `metadata` | object | No | `{ category, tags, description }` |
| `localVersion` | number | No | Incremented on each local save |
| `serverVersionTimestamp` | string | No | Last synced `versionTimestamp` |
| `createdAt` | number | No | First local save timestamp |
| `updatedAt` | number | Yes | Last local save timestamp |
| `synced` | boolean | Yes | `false` = pending server sync |

**Indexes**: `id` (primary), `[contentId, branchId]`, `updatedAt`, `synced`

```typescript
interface Draft {
  id: string;                      // `${contentId}:${branchId}`
  contentId: string;
  branchId: string;
  title: string;
  body: string;
  metadata: {
    category?: string;
    tags?: string[];
    description?: string;
  };
  localVersion: number;
  serverVersionTimestamp: string | null;  // null = new content
  createdAt: number;
  updatedAt: number;
  synced: boolean;
}
```

#### Table: `editSessions`

Tracks active editing sessions for crash recovery and multi-tab detection.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string | Primary | Session UUID |
| `contentId` | string | Yes | Content being edited |
| `branchId` | string | Yes | Branch context |
| `userId` | string | Yes | Authenticated user ID |
| `startedAt` | number | No | Session start timestamp |
| `lastActivityAt` | number | Yes | Last keystroke/action timestamp |
| `deviceId` | string | No | Browser fingerprint for multi-device |

**Indexes**: `id` (primary), `[contentId, branchId]`, `lastActivityAt`

```typescript
interface EditSession {
  id: string;
  contentId: string;
  branchId: string;
  userId: string;
  startedAt: number;
  lastActivityAt: number;
  deviceId: string;
}
```

#### Table: `syncQueue`

Queues failed sync operations for retry with exponential backoff.

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | number | Primary (auto) | Auto-increment ID |
| `draftId` | string | Yes | Reference to `drafts.id` |
| `operation` | string | No | `'sync'` or `'delete'` |
| `attempts` | number | No | Retry count |
| `maxAttempts` | number | No | Retry limit (default: 5) |
| `nextRetryAt` | number | Yes | Scheduled retry timestamp |
| `lastError` | string | No | Last error message |
| `createdAt` | number | Yes | Queue entry timestamp |

**Indexes**: `++id` (auto-primary), `draftId`, `nextRetryAt`, `createdAt`

```typescript
interface SyncQueueItem {
  id?: number;                  // Auto-increment
  draftId: string;
  operation: 'sync' | 'delete';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: number;
}
```

### Dexie Database Definition

```typescript
// frontend/src/services/draft-db.ts
import Dexie, { type Table } from 'dexie';

export class DraftDatabase extends Dexie {
  drafts!: Table<Draft, string>;
  editSessions!: Table<EditSession, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('EchoPortalDrafts');

    this.version(1).stores({
      drafts: 'id, contentId, branchId, updatedAt, synced',
      editSessions: 'id, [contentId+branchId], lastActivityAt',
      syncQueue: '++id, draftId, nextRetryAt, createdAt'
    });
  }
}

export const draftDb = new DraftDatabase();
```

---

## 2. Server-Side Types (Additions to Shared Types)

### New Types in `/shared/types/content.ts`

```typescript
/**
 * Input for syncing a draft from client to server.
 * Used by auto-save and manual "Save Draft" operations.
 */
export interface DraftSyncInput {
  /** Content UUID being edited */
  contentId: string;
  /** Branch UUID context */
  branchId: string;
  /** Updated title (optional - only if changed) */
  title?: string;
  /** Updated markdown body */
  body: string;
  /** Updated metadata (optional) */
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
  };
  /** Last known server version for conflict detection */
  expectedServerVersion: string | null;
  /** Description for version history */
  changeDescription: string;
}

/**
 * Response from draft sync operation.
 */
export interface DraftSyncResult {
  /** Whether sync succeeded */
  success: boolean;
  /** New version timestamp if successful */
  newVersionTimestamp?: string;
  /** Conflict details if version mismatch */
  conflict?: {
    /** Current server version timestamp */
    serverVersionTimestamp: string;
    /** Server version author */
    serverVersionAuthor: UserSummary;
    /** Server version content for merge UI */
    serverBody: string;
  };
}

/**
 * Input for creating a branch from published content.
 * Initiates the "Edit" workflow from Library view.
 */
export interface EditBranchCreateInput {
  /** Published content to fork */
  sourceContentId: string;
  /** Human-readable branch name */
  name: string;
  /** URL-safe branch slug */
  slug: string;
}

/**
 * Response when branch is created for editing.
 */
export interface EditBranchCreateResult {
  /** Created branch details */
  branch: BranchSummary;
  /** Copied content in the new branch */
  content: ContentDetail;
}
```

---

## 3. State Transitions

### Draft Lifecycle (Client-Side)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (IndexedDB)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [User starts editing]                                             │
│           │                                                         │
│           ▼                                                         │
│   ┌───────────────┐                                                 │
│   │  NEW DRAFT    │  localVersion: 1                                │
│   │  synced: false│  serverVersionTimestamp: null                   │
│   └───────┬───────┘                                                 │
│           │                                                         │
│           │ (2s debounce)                                           │
│           ▼                                                         │
│   ┌───────────────┐         ┌───────────────┐                       │
│   │  SAVING...    │────────▶│  SYNCED       │                       │
│   │  synced: false│  success│  synced: true │                       │
│   └───────────────┘         │  serverVersion│                       │
│           │                 │  = newVersion │                       │
│           │ failure         └───────────────┘                       │
│           ▼                         │                               │
│   ┌───────────────┐                 │ (user edits)                  │
│   │  QUEUED       │                 │                               │
│   │  syncQueue++  │                 ▼                               │
│   └───────────────┘         ┌───────────────┐                       │
│           │                 │  DIRTY        │                       │
│           │ (retry)         │  synced: false│                       │
│           └────────────────▶│  localVersion++                       │
│                             └───────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sync Conflict Resolution

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CONFLICT DETECTION                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Client sends: { body, expectedServerVersion: "2024-01-31T10:00" }  │
│                                                                      │
│   Server checks: currentVersion.timestamp === expectedServerVersion  │
│                                                                      │
│   ┌─────────────┐                    ┌─────────────┐                 │
│   │  MATCH      │                    │  MISMATCH   │                 │
│   │             │                    │  (409)      │                 │
│   └──────┬──────┘                    └──────┬──────┘                 │
│          │                                  │                        │
│          ▼                                  ▼                        │
│   ┌─────────────┐                    ┌─────────────┐                 │
│   │ Create new  │                    │ Return      │                 │
│   │ version     │                    │ conflict    │                 │
│   │ 201 Created │                    │ details     │                 │
│   └─────────────┘                    └─────────────┘                 │
│                                             │                        │
│                                             ▼                        │
│                                      ┌─────────────┐                 │
│                                      │ Client shows│                 │
│                                      │ merge UI    │                 │
│                                      └─────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA RELATIONSHIPS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   SERVER (PostgreSQL)                    CLIENT (IndexedDB)         │
│   ═══════════════════                    ══════════════════         │
│                                                                     │
│   ┌─────────────┐                        ┌─────────────┐            │
│   │  branches   │◄───────────────────────│   drafts    │            │
│   │  (existing) │      branchId          │   (new)     │            │
│   └──────┬──────┘                        └──────┬──────┘            │
│          │                                      │                   │
│          │ 1:N                                  │ 1:1               │
│          ▼                                      ▼                   │
│   ┌─────────────┐                        ┌─────────────┐            │
│   │  contents   │◄───────────────────────│ editSessions│            │
│   │  (existing) │      contentId         │   (new)     │            │
│   └──────┬──────┘                        └─────────────┘            │
│          │                                                          │
│          │ 1:N                                                      │
│          ▼                                                          │
│   ┌─────────────┐                        ┌─────────────┐            │
│   │ contentVers │                        │  syncQueue  │            │
│   │  (existing) │◄───────────────────────│   (new)     │            │
│   └─────────────┘   expectedServerVer    └─────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Validation Rules

### Draft Validation (Client-Side)

```typescript
const draftSchema = z.object({
  id: z.string().regex(/^[a-f0-9-]+:[a-f0-9-]+$/),  // UUID:UUID format
  contentId: z.string().uuid(),
  branchId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(50 * 1024 * 1024),  // 50MB limit
  metadata: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().max(500).optional()
  }),
  localVersion: z.number().int().positive(),
  serverVersionTimestamp: z.string().datetime().nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  synced: z.boolean()
});
```

### Sync Input Validation (Server-Side)

```typescript
const draftSyncInputSchema = z.object({
  contentId: z.string().uuid(),
  branchId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(50 * 1024 * 1024),
  metadata: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().max(500).optional()
  }).optional(),
  expectedServerVersion: z.string().datetime().nullable(),
  changeDescription: z.string().min(1).max(500)
});
```

---

## 6. Indexing Strategy

### IndexedDB Indexes

| Table | Index | Query Pattern |
|-------|-------|---------------|
| `drafts` | `id` (primary) | Get draft by composite key |
| `drafts` | `[contentId+branchId]` | Find draft for content in branch |
| `drafts` | `synced` | Find all unsynced drafts |
| `drafts` | `updatedAt` | Sort by most recent |
| `editSessions` | `id` (primary) | Get session by ID |
| `editSessions` | `[contentId+branchId]` | Find sessions for content |
| `editSessions` | `lastActivityAt` | Detect stale sessions |
| `syncQueue` | `++id` (auto) | FIFO processing |
| `syncQueue` | `nextRetryAt` | Find ready-to-retry items |

### Query Patterns

```typescript
// Get draft for editing
const draft = await draftDb.drafts.get(`${contentId}:${branchId}`);

// Find all unsynced drafts
const unsynced = await draftDb.drafts.where('synced').equals(false).toArray();

// Get retry queue items ready to process
const ready = await draftDb.syncQueue
  .where('nextRetryAt')
  .belowOrEqual(Date.now())
  .toArray();

// Detect abandoned sessions (no activity > 1 hour)
const stale = await draftDb.editSessions
  .where('lastActivityAt')
  .below(Date.now() - 3600000)
  .toArray();
```

---

## 7. Migration Strategy

### IndexedDB Schema Versioning

```typescript
// Version 1: Initial schema
this.version(1).stores({
  drafts: 'id, contentId, branchId, updatedAt, synced',
  editSessions: 'id, [contentId+branchId], lastActivityAt',
  syncQueue: '++id, draftId, nextRetryAt, createdAt'
});

// Future Version 2: Example migration
this.version(2).stores({
  drafts: 'id, contentId, branchId, updatedAt, synced, [branchId+synced]',
  // ... other tables unchanged
}).upgrade(tx => {
  // Migration logic for existing data
  return tx.table('drafts').toCollection().modify(draft => {
    // Add new fields with defaults
    if (draft.newField === undefined) {
      draft.newField = 'default';
    }
  });
});
```

### Server Schema

No PostgreSQL schema changes required. The existing `contents` and `contentVersions` tables support all sync operations.
