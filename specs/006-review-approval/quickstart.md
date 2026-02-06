# Quickstart: In-Context Review and Approval Implementation

**Feature**: 006-review-approval
**Date**: 2026-02-03

## Implementation Overview

This guide provides a phased approach to implementing the in-context review and approval experience. The implementation builds on existing infrastructure while adding new components for diff viewing, inline commenting, and unified review decisions.

## Prerequisites

Before starting, ensure you have:

1. **Existing infrastructure understanding**:
   - Review service at `/backend/src/services/review/`
   - State machine at `/backend/src/services/workflow/`
   - Diff utilities at `/backend/src/services/git/diff.ts`
   - Library page at `/frontend/src/pages/Library.tsx`

2. **Database access** for migrations

3. **Feature flag** (optional but recommended): `FEATURE_IN_CONTEXT_REVIEW`

## Phase 1: Backend Foundation

### Step 1.1: Database Migrations

Create the review snapshots table:

```typescript
// /backend/src/db/migrations/XXXX_add_review_snapshots.ts
import { sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';

export async function up(db: PgTransaction<any, any, any>) {
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

export async function down(db: PgTransaction<any, any, any>) {
  await db.execute(sql`DROP TABLE review_snapshots;`);
}
```

Add review cycle tracking:

```typescript
// /backend/src/db/migrations/XXXX_add_review_cycle.ts
import { sql } from 'drizzle-orm';

export async function up(db: PgTransaction<any, any, any>) {
  await db.execute(sql`
    ALTER TABLE reviews ADD COLUMN review_cycle INTEGER NOT NULL DEFAULT 1;
    CREATE INDEX idx_reviews_branch_cycle ON reviews(branch_id, review_cycle);
  `);
}
```

### Step 1.2: Drizzle Schema Updates

```typescript
// /backend/src/db/schema/review-snapshots.ts
import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { reviews } from './reviews.js';
import { branches } from './branches.js';
import type { SnapshotData } from '@echo-portal/shared';

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

Update index.ts to export new schema:

```typescript
// /backend/src/db/schema/index.ts
export * from './review-snapshots.js';
```

### Step 1.3: Snapshot Service

```typescript
// /backend/src/services/review/snapshot-service.ts
import { db } from '../../db/index.js';
import { reviewSnapshots } from '../../db/schema/review-snapshots.js';
import { branches } from '../../db/schema/branches.js';
import { eq } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import type { SnapshotData, ReviewSnapshot } from '@echo-portal/shared';

export class SnapshotService {
  async createSnapshot(reviewId: string, branchId: string): Promise<ReviewSnapshot> {
    // Get branch for commit refs
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    // Get diff summary for snapshot data
    const diff = await diffService.getChangeSummary(branchId);

    const snapshotData: SnapshotData = {
      files: diff.files.map(f => ({
        path: f.path,
        status: f.status,
        oldPath: f.oldPath,
        additions: f.additions,
        deletions: f.deletions,
      })),
      stats: diff.stats,
      baseRef: branch.baseRef || 'main',
      headRef: branch.gitRef,
    };

    const [snapshot] = await db
      .insert(reviewSnapshots)
      .values({
        reviewId,
        branchId,
        baseCommit: branch.baseCommit || '',
        headCommit: branch.headCommit || '',
        snapshotData,
      })
      .returning();

    return snapshot;
  }

  async getByReviewId(reviewId: string): Promise<ReviewSnapshot | null> {
    return db.query.reviewSnapshots.findFirst({
      where: eq(reviewSnapshots.reviewId, reviewId),
    });
  }
}

export const snapshotService = new SnapshotService();
```

### Step 1.4: Comparison Service

```typescript
// /backend/src/services/review/comparison-service.ts
import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { eq } from 'drizzle-orm';
import { diffService } from '../git/diff.js';
import type { BranchComparison, FileDiff } from '@echo-portal/shared';

export class ComparisonService {
  async getBranchComparison(branchId: string, snapshotId?: string): Promise<BranchComparison> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    // Get full diff
    const diff = await diffService.getBranchDiff(branchId);

    // Check for base divergence
    const baseState = await this.checkBaseDivergence(branch);

    return {
      branchId,
      baseCommit: branch.baseCommit || '',
      headCommit: branch.headCommit || '',
      baseRef: branch.baseRef || 'main',
      headRef: branch.gitRef,
      files: diff.files,
      stats: diff.stats,
      baseState: baseState.diverged ? 'diverged' : 'current',
      divergedCommit: baseState.divergedCommit,
    };
  }

  async getFileDiff(branchId: string, filePath: string): Promise<FileDiff | null> {
    const comparison = await this.getBranchComparison(branchId);
    return comparison.files.find(f => f.path === filePath) || null;
  }

  private async checkBaseDivergence(branch: any): Promise<{ diverged: boolean; divergedCommit?: string }> {
    // Check if main has moved since branch creation
    // Implementation depends on git service capabilities
    // For now, return not diverged
    return { diverged: false };
  }
}

export const comparisonService = new ComparisonService();
```

### Step 1.5: Enhanced Review Service

Update the review service to create snapshots:

```typescript
// Add to /backend/src/services/review/review-service.ts

import { snapshotService } from './snapshot-service.js';

// In create() method, after creating review:
const snapshot = await snapshotService.createSnapshot(newReview.id, input.branchId);

// Add new method:
async getReviewCycles(branchId: string): Promise<ReviewCycleSummary[]> {
  const reviews = await this.list({ branchId });
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });

  const cycleMap = new Map<number, Review[]>();
  for (const review of reviews) {
    const cycle = review.reviewCycle || 1;
    if (!cycleMap.has(cycle)) {
      cycleMap.set(cycle, []);
    }
    cycleMap.get(cycle)!.push(review);
  }

  return Array.from(cycleMap.entries()).map(([cycleNumber, cycleReviews]) => ({
    cycleNumber,
    submittedAt: cycleReviews[0].createdAt,
    outcome: this.deriveCycleOutcome(cycleReviews),
    approvalCount: cycleReviews.filter(r => r.decision === 'approved').length,
    requiredApprovals: branch?.requiredApprovals || 1,
    reviewerCount: cycleReviews.length,
  }));
}

private deriveCycleOutcome(reviews: Review[]): CycleOutcome {
  const active = reviews.filter(r => r.status !== 'cancelled');
  if (active.some(r => r.decision === 'changes_requested')) {
    return 'changes_requested';
  }
  if (active.every(r => r.decision === 'approved')) {
    return 'approved';
  }
  return 'pending';
}
```

### Step 1.6: API Routes

```typescript
// /backend/src/api/routes/comparison.ts
import { Hono } from 'hono';
import { comparisonService } from '../../services/review/comparison-service.js';
import { authMiddleware } from '../middleware/auth.js';

const app = new Hono();

app.use('*', authMiddleware);

// GET /api/v1/branches/:branchId/comparison
app.get('/branches/:branchId/comparison', async (c) => {
  const { branchId } = c.req.param();
  const snapshotId = c.req.query('snapshotId');

  const comparison = await comparisonService.getBranchComparison(branchId, snapshotId);
  return c.json(comparison);
});

// GET /api/v1/branches/:branchId/comparison/files/:filePath
app.get('/branches/:branchId/comparison/files/:filePath', async (c) => {
  const { branchId, filePath } = c.req.param();

  const diff = await comparisonService.getFileDiff(branchId, decodeURIComponent(filePath));
  if (!diff) {
    return c.json({ message: 'File not found in diff' }, 404);
  }
  return c.json(diff);
});

export default app;
```

## Phase 2: Comment Threading Enhancement

### Step 2.1: Enhanced Comment Service

```typescript
// Update /backend/src/services/review/comments.ts

async addReply(
  reviewId: string,
  parentCommentId: string,
  content: string,
  authorId: string
): Promise<ReviewComment> {
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) throw new NotFoundError('Review', reviewId);

  const comments = (review.comments as ReviewComment[]) || [];
  const parent = comments.find(c => c.id === parentCommentId);

  if (!parent) throw new NotFoundError('Comment', parentCommentId);

  // Check max depth (2 levels)
  if (parent.parentId) {
    throw new ValidationError('Cannot reply to a reply (max depth exceeded)');
  }

  const reply: ReviewComment = {
    id: uuidv4(),
    authorId,
    content,
    parentId: parentCommentId,
    isOutdated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(reviews)
    .set({
      comments: [...comments, reply],
      status: review.status === 'pending' ? 'in_progress' : review.status,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId));

  return reply;
}

async refreshOutdatedStatus(reviewId: string): Promise<{ updatedCount: number; comments: ReviewComment[] }> {
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) throw new NotFoundError('Review', reviewId);

  const snapshot = await snapshotService.getByReviewId(reviewId);
  if (!snapshot) {
    return { updatedCount: 0, comments: review.comments as ReviewComment[] };
  }

  // Get current diff
  const currentDiff = await comparisonService.getBranchComparison(review.branchId);

  const comments = (review.comments as ReviewComment[]) || [];
  let updatedCount = 0;

  const updatedComments = comments.map(comment => {
    if (!comment.path || comment.isOutdated) return comment;

    // Check if the file/line still exists in current diff
    const file = currentDiff.files.find(f => f.path === comment.path);
    if (!file) {
      updatedCount++;
      return {
        ...comment,
        isOutdated: true,
        outdatedReason: 'File no longer in diff',
      };
    }

    // Check if specific line context changed
    // (Simplified - full implementation would compare line content)
    if (comment.line && comment.hunkId) {
      const hunk = file.hunks.find(h => h.id === comment.hunkId);
      if (!hunk) {
        updatedCount++;
        return {
          ...comment,
          isOutdated: true,
          outdatedReason: 'Referenced code section changed',
        };
      }
    }

    return comment;
  });

  if (updatedCount > 0) {
    await db
      .update(reviews)
      .set({ comments: updatedComments, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
  }

  return { updatedCount, comments: updatedComments };
}
```

## Phase 3: Frontend Components

### Step 3.1: Review Context Provider

```typescript
// /frontend/src/context/ReviewContext.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { BranchComparison, ReviewComment, ReviewResponse } from '@echo-portal/shared';

interface ReviewContextValue {
  comparison: BranchComparison | null;
  reviews: ReviewResponse[];
  activeReview: ReviewResponse | null;
  comments: ReviewComment[];
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  refreshComparison: () => Promise<void>;
  refreshReviews: () => Promise<void>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({
  branchId,
  children,
}: {
  branchId: string;
  children: ReactNode;
}) {
  // Implementation uses React Query for data fetching
  // Provides unified access to review state
}

export function useReviewContext() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error('useReviewContext must be within ReviewProvider');
  return ctx;
}
```

### Step 3.2: DiffView Component

```typescript
// /frontend/src/components/review/DiffView.tsx
import { useState, useCallback } from 'react';
import type { BranchComparison, FileDiff, DiffLine, ReviewComment } from '@echo-portal/shared';
import { DiffFileHeader } from './DiffFileHeader';
import { DiffHunk } from './DiffHunk';
import { InlineCommentForm } from './InlineCommentForm';

interface DiffViewProps {
  comparison: BranchComparison;
  comments: ReviewComment[];
  onAddComment: (path: string, line: number, side: 'old' | 'new', content: string) => Promise<void>;
  displayMode: 'unified' | 'split';
}

export function DiffView({ comparison, comments, onAddComment, displayMode }: DiffViewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [commentingAt, setCommentingAt] = useState<{
    path: string;
    line: number;
    side: 'old' | 'new';
  } | null>(null);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const getCommentsForLine = useCallback(
    (path: string, line: number, side: 'old' | 'new') =>
      comments.filter(c => c.path === path && c.line === line && c.side === side),
    [comments]
  );

  return (
    <div className="diff-view">
      <div className="diff-stats">
        <span className="text-green-600">+{comparison.stats.additions}</span>
        <span className="text-red-600">-{comparison.stats.deletions}</span>
        <span>{comparison.stats.filesChanged} files changed</span>
      </div>

      {comparison.baseState === 'diverged' && (
        <div className="divergence-warning bg-yellow-50 border-yellow-200 p-3 rounded mb-4">
          <strong>Note:</strong> The base branch has changed since this branch was created.
          The comparison shows changes relative to the original base.
        </div>
      )}

      {comparison.files.map(file => (
        <div key={file.path} className="diff-file border rounded mb-4">
          <DiffFileHeader
            file={file}
            isExpanded={expandedFiles.has(file.path)}
            onToggle={() => toggleFile(file.path)}
          />

          {expandedFiles.has(file.path) && (
            <div className="diff-content">
              {file.hunks.map(hunk => (
                <DiffHunk
                  key={hunk.id}
                  hunk={hunk}
                  filePath={file.path}
                  displayMode={displayMode}
                  getComments={getCommentsForLine}
                  onLineClick={(line, side) =>
                    setCommentingAt({ path: file.path, line, side })
                  }
                  commentingAt={commentingAt?.path === file.path ? commentingAt : null}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {commentingAt && (
        <InlineCommentForm
          path={commentingAt.path}
          line={commentingAt.line}
          side={commentingAt.side}
          onSubmit={async (content) => {
            await onAddComment(commentingAt.path, commentingAt.line, commentingAt.side, content);
            setCommentingAt(null);
          }}
          onCancel={() => setCommentingAt(null)}
        />
      )}
    </div>
  );
}
```

### Step 3.3: Review Overlay

```typescript
// /frontend/src/components/review/ReviewOverlay.tsx
import { useState } from 'react';
import { DiffView } from './DiffView';
import { ReviewDecisionPanel } from './ReviewDecisionPanel';
import { ReviewCommentsSidebar } from './ReviewCommentsSidebar';
import { ReviewStatusHeader } from './ReviewStatusHeader';
import { useReviewContext } from '../../context/ReviewContext';

interface ReviewOverlayProps {
  branchId: string;
  onClose: () => void;
}

export function ReviewOverlay({ branchId, onClose }: ReviewOverlayProps) {
  const {
    comparison,
    reviews,
    activeReview,
    comments,
  } = useReviewContext();

  const [showCommentsSidebar, setShowCommentsSidebar] = useState(true);
  const [displayMode, setDisplayMode] = useState<'unified' | 'split'>('unified');

  if (!comparison) {
    return <div>Loading comparison...</div>;
  }

  return (
    <div className="review-overlay fixed inset-0 bg-white z-50 flex flex-col">
      <ReviewStatusHeader
        comparison={comparison}
        reviews={reviews}
        onClose={onClose}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        showCommentsSidebar={showCommentsSidebar}
        onToggleCommentsSidebar={() => setShowCommentsSidebar(!showCommentsSidebar)}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <DiffView
            comparison={comparison}
            comments={comments}
            onAddComment={handleAddComment}
            displayMode={displayMode}
          />
        </div>

        {showCommentsSidebar && (
          <ReviewCommentsSidebar
            comments={comments}
            reviews={reviews}
          />
        )}
      </div>

      {activeReview && (
        <ReviewDecisionPanel
          review={activeReview}
          onApprove={handleApprove}
          onRequestChanges={handleRequestChanges}
        />
      )}
    </div>
  );
}
```

### Step 3.4: Library Page Integration

```typescript
// Update /frontend/src/pages/Library.tsx

import { ReviewOverlay } from '../components/review/ReviewOverlay';
import { ReviewProvider } from '../context/ReviewContext';

// In component:
const reviewMode = searchParams.get('mode') === 'review';
const reviewBranchId = searchParams.get('branchId');

// In render, add:
{reviewMode && reviewBranchId && (
  <ReviewProvider branchId={reviewBranchId}>
    <ReviewOverlay
      branchId={reviewBranchId}
      onClose={() => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('mode');
          next.delete('branchId');
          return next;
        });
      }}
    />
  </ReviewProvider>
)}
```

## Phase 4: Notification Integration

### Step 4.1: Review Event Notifications

```typescript
// /backend/src/services/review/review-notifications.ts
import { notificationService } from '../notification/notification-service.js';
import type { Review, ReviewComment } from '@echo-portal/shared';

export async function notifyReviewSubmitted(review: Review, reviewerIds: string[]) {
  await notificationService.createBulk(
    reviewerIds.map(userId => ({
      userId,
      type: 'review_requested',
      title: 'Review Requested',
      message: `You have been assigned to review branch changes`,
      resourceType: 'review',
      resourceId: review.id,
    }))
  );
}

export async function notifyCommentAdded(
  review: Review,
  comment: ReviewComment,
  recipientIds: string[]
) {
  await notificationService.createBulk(
    recipientIds.map(userId => ({
      userId,
      type: 'review_comment_added',
      title: 'New Review Comment',
      message: `New comment on your review`,
      resourceType: 'review',
      resourceId: review.id,
    }))
  );
}

export async function notifyDecisionMade(
  review: Review,
  decision: 'approved' | 'changes_requested',
  branchOwnerId: string
) {
  await notificationService.create({
    userId: branchOwnerId,
    type: decision === 'approved' ? 'review_completed' : 'changes_requested',
    title: decision === 'approved' ? 'Review Approved' : 'Changes Requested',
    message: decision === 'approved'
      ? 'Your branch has been approved'
      : 'A reviewer has requested changes on your branch',
    resourceType: 'review',
    resourceId: review.id,
  });
}
```

## Phase 5: Testing

### Step 5.1: Integration Tests

```typescript
// /backend/tests/integration/in-context-review.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testClient } from '../utils/test-client';

describe('In-Context Review', () => {
  describe('Comparison', () => {
    it('returns branch comparison with diff', async () => {
      const res = await testClient.get(`/api/v1/branches/${branchId}/comparison`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('files');
      expect(res.body).toHaveProperty('stats');
      expect(res.body.baseState).toMatch(/^(current|diverged)$/);
    });

    it('detects base divergence', async () => {
      // Create scenario where main has moved
      // Verify comparison shows diverged state
    });
  });

  describe('Snapshots', () => {
    it('creates snapshot on review creation', async () => {
      const res = await testClient.post('/api/v1/reviews', {
        branchId,
        reviewerId,
      });
      expect(res.body.snapshotId).toBeDefined();
    });

    it('preserves snapshot when branch changes after submission', async () => {
      // Submit for review
      // Make changes to branch (should fail due to immutability)
      // Verify snapshot unchanged
    });
  });

  describe('Comments', () => {
    it('adds inline comment anchored to diff line', async () => {
      const res = await testClient.post(`/api/v1/reviews/${reviewId}/comments`, {
        content: 'Consider refactoring this',
        path: 'src/example.ts',
        line: 42,
        side: 'new',
      });
      expect(res.status).toBe(201);
      expect(res.body.path).toBe('src/example.ts');
    });

    it('supports threaded replies', async () => {
      const reply = await testClient.post(
        `/api/v1/reviews/${reviewId}/comments/${commentId}/reply`,
        { content: 'Good point, will fix' }
      );
      expect(reply.body.parentId).toBe(commentId);
    });

    it('marks comments as outdated when content changes', async () => {
      // Add comment
      // Return branch to draft
      // Make changes
      // Resubmit
      // Refresh comments
      // Verify outdated status
    });
  });

  describe('Review Decisions', () => {
    it('records approval with audit trail', async () => {
      const res = await testClient.post(`/api/v1/reviews/${reviewId}/approve`);
      expect(res.body.review.decision).toBe('approved');
      // Verify audit log entry
    });

    it('prevents self-approval', async () => {
      // Attempt approval as branch owner
      const res = await testClient.post(`/api/v1/reviews/${reviewId}/approve`);
      expect(res.status).toBe(403);
    });

    it('transitions branch to approved when threshold met', async () => {
      // With requiredApprovals = 2
      // First approval
      // Second approval
      // Verify branch state = 'approved'
    });

    it('returns branch to draft on changes requested', async () => {
      const res = await testClient.post(`/api/v1/reviews/${reviewId}/request-changes`, {
        reason: 'Please add tests',
      });
      expect(res.body.branchState).toBe('draft');
    });
  });
});
```

### Step 5.2: Frontend Tests

```typescript
// /frontend/tests/components/DiffView.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffView } from '../../src/components/review/DiffView';

describe('DiffView', () => {
  it('renders file list with stats', () => {
    render(<DiffView comparison={mockComparison} comments={[]} />);
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('expands file to show hunks on click', () => {
    render(<DiffView comparison={mockComparison} comments={[]} />);
    fireEvent.click(screen.getByText('src/example.ts'));
    expect(screen.getByText('@@ -1,5 +1,8 @@')).toBeInTheDocument();
  });

  it('shows inline comments at correct positions', () => {
    render(<DiffView comparison={mockComparison} comments={mockComments} />);
    // Expand file
    fireEvent.click(screen.getByText('src/example.ts'));
    expect(screen.getByText('Consider refactoring')).toBeInTheDocument();
  });

  it('opens comment form on line click', () => {
    render(<DiffView comparison={mockComparison} comments={[]} />);
    // Click on diff line
    // Verify comment form appears
  });
});
```

## Verification Checklist

Before marking implementation complete:

- [ ] All migrations run successfully
- [ ] Comparison endpoint returns accurate diffs (FR-005)
- [ ] Snapshots created on review submission (FR-003)
- [ ] Comments can be anchored to diff lines (FR-007)
- [ ] Threading works with 2-level max depth (FR-008)
- [ ] Outdated comments marked correctly (FR-018)
- [ ] Self-approval prevented (FR-013a)
- [ ] Approval threshold enforced (FR-002a)
- [ ] Branch returns to draft on changes requested (FR-010)
- [ ] All audit events logged (FR-019)
- [ ] Notifications sent for review events (FR-004)
- [ ] UI renders in-context within Library page
- [ ] 5-second comparison load time met (SC-002)
- [ ] All tests passing
