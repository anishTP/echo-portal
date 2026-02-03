# Data Model: In-Context Review and Approval Workflow

**Feature**: 006-review-approval
**Date**: 2026-02-03
**Spec**: [spec.md](./spec.md)

## Entity Overview

This data model extends the existing Echo Portal schema to support in-context review workflows with inline commenting, comparison snapshots, and review cycle tracking.

## Core Entities

### Review (Extended)

Extends the existing `reviews` table with enhanced comment structure and snapshot reference.

```typescript
interface Review {
  // Existing fields
  id: string;                          // UUID
  branchId: string;                    // FK to branches
  reviewerId: string;                  // FK to users (assigned reviewer)
  requestedById: string;               // FK to users (branch owner)
  status: ReviewStatus;                // pending | in_progress | completed | cancelled
  decision: ReviewDecision | null;     // approved | changes_requested

  // Enhanced fields
  snapshotId: string | null;           // FK to review_snapshots (NEW)
  reviewCycle: number;                 // Which submission cycle (NEW, default: 1)
  comments: ReviewComment[];           // Enhanced JSONB array (EXISTING, structure updated)

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type ReviewDecision = 'approved' | 'changes_requested';
```

**Relationships**:
- `Review` belongs to `Branch` (many-to-one)
- `Review` belongs to `User` as reviewer (many-to-one)
- `Review` belongs to `User` as requestedBy (many-to-one)
- `Review` has one `ReviewSnapshot` (one-to-one)

**Validation Rules**:
- `reviewerId` cannot equal `requestedById` (self-review prevention)
- `decision` required when `status` transitions to `completed`
- `snapshotId` populated when review is created

### ReviewSnapshot (New)

Captures the comparison state at review submission time for consistent evaluation.

```typescript
interface ReviewSnapshot {
  id: string;                          // UUID
  reviewId: string;                    // FK to reviews (unique)
  branchId: string;                    // FK to branches

  // Commit references (immutable once created)
  baseCommit: string;                  // Git commit hash (40 chars)
  headCommit: string;                  // Git commit hash (40 chars)

  // Cached comparison data
  snapshotData: SnapshotData;          // JSONB

  // Timestamps
  createdAt: Date;
}

interface SnapshotData {
  files: FileSummary[];                // Summary of changed files
  stats: DiffStats;                    // Aggregate statistics
  baseRef: string;                     // Human-readable base reference
  headRef: string;                     // Human-readable head reference
}

interface FileSummary {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;                    // For renames
  additions: number;
  deletions: number;
}

interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}
```

**Relationships**:
- `ReviewSnapshot` belongs to `Review` (one-to-one)
- `ReviewSnapshot` references `Branch` for context

**Validation Rules**:
- `baseCommit` and `headCommit` must be valid 40-character hex strings
- Snapshot is immutable after creation (no updates)

### ReviewComment (Enhanced Structure)

Comments stored as JSONB within the review record, enhanced with threading and outdated tracking.

```typescript
interface ReviewComment {
  id: string;                          // UUID
  authorId: string;                    // FK to users
  content: string;                     // Comment text (max 10,000 chars)

  // Anchoring (all optional for general comments)
  path?: string;                       // File path
  line?: number;                       // Line number in diff
  hunkId?: string;                     // Diff hunk identifier
  side?: 'old' | 'new';               // Which side of diff (deletion vs addition)

  // Threading
  parentId?: string;                   // Parent comment ID (null = top-level)

  // Staleness tracking
  isOutdated: boolean;                 // Default: false
  outdatedReason?: string;             // Why marked outdated

  // Metadata
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}
```

**Validation Rules**:
- `content` required, 1-10,000 characters
- `parentId` must reference existing comment in same review
- Thread depth limited to 2 levels (comment → reply)
- `line` required if `hunkId` provided
- `side` required if `line` provided

### ReviewCycle (Denormalized View)

Not a separate table; represents a logical grouping of reviews for the same branch submission cycle.

```typescript
interface ReviewCycle {
  cycleNumber: number;                 // 1, 2, 3...
  submittedAt: Date;                   // When this cycle started
  reviews: Review[];                   // Reviews in this cycle
  outcome: CycleOutcome;               // Derived status
}

type CycleOutcome =
  | 'pending'                          // Active, waiting for decisions
  | 'approved'                         // All required approvals received
  | 'changes_requested'                // At least one reviewer requested changes
  | 'withdrawn';                       // Contributor withdrew review
```

**Derivation Logic**:
```typescript
function deriveCycleOutcome(reviews: Review[]): CycleOutcome {
  const active = reviews.filter(r => r.status !== 'cancelled');

  if (active.some(r => r.decision === 'changes_requested')) {
    return 'changes_requested';
  }

  const requiredApprovals = branch.requiredApprovals;
  const approvedCount = active.filter(r => r.decision === 'approved').length;

  if (approvedCount >= requiredApprovals) {
    return 'approved';
  }

  return 'pending';
}
```

## Database Schema (Drizzle)

### New Table: review_snapshots

```typescript
// /backend/src/db/schema/review-snapshots.ts

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { reviews } from './reviews.js';
import { branches } from './branches.js';

export const reviewSnapshots = pgTable('review_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .unique()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id')
    .notNull()
    .references(() => branches.id, { onDelete: 'cascade' }),
  baseCommit: varchar('base_commit', { length: 40 }).notNull(),
  headCommit: varchar('head_commit', { length: 40 }).notNull(),
  snapshotData: jsonb('snapshot_data').notNull().$type<SnapshotData>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  reviewIdx: index('review_snapshots_review_idx').on(table.reviewId),
  branchIdx: index('review_snapshots_branch_idx').on(table.branchId),
}));
```

### Schema Extension: reviews

```typescript
// Update to /backend/src/db/schema/reviews.ts

// Add to existing table definition:
reviewCycle: integer('review_cycle').notNull().default(1),

// Update comments JSONB type to include new fields
// (No schema change needed - JSONB is flexible)
```

### Schema Extension: branches

```typescript
// Already exists - no changes needed
// requiredApprovals field already present for FR-002a
```

## State Transitions

### Branch State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │              BRANCH STATES                    │
                    └──────────────────────────────────────────────┘

   ┌─────────┐  SUBMIT_FOR_REVIEW  ┌─────────┐  [All required    ┌──────────┐
   │  DRAFT  │ ─────────────────▶  │ REVIEW  │   approvals]      │ APPROVED │
   └─────────┘                     └─────────┘ ────────────────▶  └──────────┘
        ▲                               │                              │
        │                               │                              │
        │  REQUEST_CHANGES              │                              │ PUBLISH
        │  or WITHDRAW                  │                              │
        └───────────────────────────────┘                              ▼
                                                               ┌───────────┐
                                                               │ PUBLISHED │
                                                               └───────────┘
```

### Review Sub-States (Derived)

```
Within BRANCH.REVIEW state:

   ┌──────────────────┐
   │  Pending Review  │  (No reviewer activity yet)
   └────────┬─────────┘
            │ Comment added
            ▼
   ┌──────────────────┐
   │  In Discussion   │  (Active comments, no decision)
   └────────┬─────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐   ┌─────────────────┐
│Approved │   │Changes Requested│ ──────────▶ Returns to BRANCH.DRAFT
└─────────┘   └─────────────────┘              (new cycle starts)
     │
     ▼
(Branch → APPROVED state)
```

## Indexes and Performance

### Required Indexes

```sql
-- Efficient review lookup by branch
CREATE INDEX idx_reviews_branch_cycle ON reviews(branch_id, review_cycle);

-- Find pending reviews for a reviewer
CREATE INDEX idx_reviews_reviewer_status ON reviews(reviewer_id, status)
  WHERE status IN ('pending', 'in_progress');

-- Snapshot lookup
CREATE INDEX idx_snapshots_review ON review_snapshots(review_id);
CREATE INDEX idx_snapshots_branch ON review_snapshots(branch_id);
```

### Query Patterns

| Query | Expected Performance | Index Used |
|-------|---------------------|------------|
| Reviews for branch | O(1) | `idx_reviews_branch_cycle` |
| My pending reviews | O(log n) | `idx_reviews_reviewer_status` |
| Review snapshot | O(1) | `idx_snapshots_review` |
| Comments for review | O(1) | Primary key (embedded JSONB) |

## Audit Log Events

All review actions generate audit log entries via existing audit service.

```typescript
type ReviewAuditAction =
  | 'review_submitted'         // Branch submitted for review
  | 'review_assigned'          // Reviewer added to review
  | 'review_unassigned'        // Reviewer removed from review
  | 'review_started'           // Reviewer began review (pending → in_progress)
  | 'review_approved'          // Reviewer approved
  | 'review_changes_requested' // Reviewer requested changes
  | 'review_withdrawn'         // Contributor withdrew review
  | 'review_cancelled'         // Review cancelled
  | 'comment_added'            // Comment created
  | 'comment_updated'          // Comment edited
  | 'comment_deleted'          // Comment removed
  | 'comments_outdated';       // Comments marked as outdated

interface ReviewAuditMetadata {
  reviewId: string;
  branchId: string;
  reviewCycle: number;
  commentId?: string;           // For comment actions
  decision?: ReviewDecision;    // For decision actions
  reason?: string;              // For changes_requested or withdrawal
  snapshotId?: string;          // For submission
}
```

## Migration Strategy

### Migration 1: Add review_snapshots table

```typescript
// /backend/src/db/migrations/XXXX_add_review_snapshots.ts
import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.execute(sql`
    CREATE TABLE review_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
      branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      base_commit VARCHAR(40) NOT NULL,
      head_commit VARCHAR(40) NOT NULL,
      snapshot_data JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_review_snapshots_review ON review_snapshots(review_id);
    CREATE INDEX idx_review_snapshots_branch ON review_snapshots(branch_id);
  `);
}

export async function down(db) {
  await db.execute(sql`DROP TABLE review_snapshots;`);
}
```

### Migration 2: Add review_cycle to reviews

```typescript
// /backend/src/db/migrations/XXXX_add_review_cycle.ts
import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.execute(sql`
    ALTER TABLE reviews ADD COLUMN review_cycle INTEGER NOT NULL DEFAULT 1;
    CREATE INDEX idx_reviews_branch_cycle ON reviews(branch_id, review_cycle);
  `);
}

export async function down(db) {
  await db.execute(sql`
    DROP INDEX idx_reviews_branch_cycle;
    ALTER TABLE reviews DROP COLUMN review_cycle;
  `);
}
```

## Type Definitions (Shared)

```typescript
// /shared/types/review.ts (additions)

export interface ReviewSnapshot {
  id: string;
  reviewId: string;
  branchId: string;
  baseCommit: string;
  headCommit: string;
  snapshotData: SnapshotData;
  createdAt: string;
}

export interface SnapshotData {
  files: FileSummary[];
  stats: DiffStats;
  baseRef: string;
  headRef: string;
}

export interface FileSummary {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  path?: string;
  line?: number;
  hunkId?: string;
  side?: 'old' | 'new';
  parentId?: string;
  isOutdated: boolean;
  outdatedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewSubState =
  | 'pending_review'
  | 'in_discussion'
  | 'changes_requested'
  | 'approved';

export interface ReviewCycleSummary {
  cycleNumber: number;
  submittedAt: string;
  outcome: 'pending' | 'approved' | 'changes_requested' | 'withdrawn';
  approvalCount: number;
  requiredApprovals: number;
  reviewerCount: number;
}
```
