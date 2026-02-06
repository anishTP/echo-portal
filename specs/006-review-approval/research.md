# Research: In-Context Review and Approval Workflow

**Feature**: 006-review-approval
**Date**: 2026-02-03

## Executive Summary

This research documents findings for implementing an in-context review and approval experience within Echo Portal. The goal is to allow reviewers to evaluate, discuss, and decide on proposed changes directly within the content library view rather than through a detached dashboard-only flow.

## Technical Context Findings

### 1. Existing Architecture Analysis

#### State Machine (XState-based)
**Decision**: Leverage existing XState state machine pattern
**Rationale**: The codebase already has a mature state machine implementation at `/backend/src/services/workflow/state-machine.ts` with guards, actions, and well-defined transitions. Extending this pattern maintains consistency.
**Alternatives Considered**:
- Custom state management: Rejected due to loss of XState benefits (visualization, guards, type safety)
- Separate review state machine: Rejected to avoid complexity; review sub-states can be modeled within existing structure

#### Diff Service
**Decision**: Extend existing diff service at `/backend/src/services/git/diff.ts`
**Rationale**: Already provides `getBranchDiff()`, `getChangeSummary()`, and comprehensive diff formatting with LCS algorithm. Has HTML formatting support for rendering.
**Alternatives Considered**:
- External diff library (e.g., diff-match-patch): Rejected as existing implementation handles all use cases
- Client-side diffing: Rejected for security and consistency reasons

#### Comment Model
**Decision**: Extend existing `ReviewComment` structure to support threading and outdated marking
**Rationale**: Existing model at `/backend/src/services/review/comments.ts` already supports path/line anchoring. Need to add `parentId` for threading and `isOutdated` for staleness tracking.
**Alternatives Considered**:
- Separate comment table: Rejected to maintain atomic review operations
- Flat comments with client-side threading: Rejected for query complexity and consistency

### 2. Database Schema Decisions

#### Review Comments Enhancement
**Decision**: Add threading and outdated tracking to existing JSONB `comments` field
**Structure Addition**:
```typescript
interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  path?: string;           // File path for anchoring
  line?: number;           // Line number for anchoring
  hunkId?: string;         // NEW: Diff hunk identifier for comment anchoring
  parentId?: string;       // NEW: For threading (null = top-level)
  isOutdated?: boolean;    // NEW: Marked when referenced content changes
  outdatedReason?: string; // NEW: Description of what changed
  createdAt: string;
  updatedAt: string;
}
```
**Rationale**: JSONB approach maintains atomic operations and avoids join complexity for a per-review scoped entity.

#### Comparison Snapshots
**Decision**: Store comparison snapshot references in new `review_snapshots` table
**Structure**:
```sql
CREATE TABLE review_snapshots (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES reviews(id),
  base_commit VARCHAR(40) NOT NULL,  -- Git commit hash
  head_commit VARCHAR(40) NOT NULL,  -- Git commit hash
  snapshot_data JSONB,               -- Cached diff summary
  created_at TIMESTAMP DEFAULT NOW()
);
```
**Rationale**: Separates snapshot storage from review record; allows efficient caching of comparison data while preserving exact commit references for auditing.
**Alternatives Considered**:
- Inline JSONB in reviews table: Rejected due to potential size and query performance
- Full content snapshots: Rejected as git commits already preserve this

### 3. Frontend Architecture Decisions

#### In-Context Review Surface
**Decision**: Add `ReviewOverlay` component that renders within Library page context
**Rationale**:
- Maintains content context (user stays on `/library` route)
- Leverages existing `LibrarySidebar`, `ContentRenderer` infrastructure
- Can show diff in main content area with sidebar for comments/actions
**Implementation**:
- URL pattern: `/library?mode=review&branchId={id}`
- Reuses existing `branchMode` logic from Library.tsx
- ReviewOverlay becomes conditional render alongside existing edit/view modes

**Alternatives Considered**:
- Full-page review route (`/review/:branchId`): Rejected as it breaks "in-context" requirement
- Modal/dialog overlay: Rejected for insufficient space for diff + comments

#### Diff Rendering
**Decision**: Create `DiffView` component with split-pane layout
**Features**:
- Side-by-side or unified diff toggle
- Syntax highlighting via existing `getFileLanguage()`
- Collapsible file sections
- Line-level comment anchoring with click-to-add-comment
**Rationale**: Similar to GitHub PR review interface; proven UX pattern.

#### Comment Threading UI
**Decision**: Nested comment threads with collapse/expand
**Rationale**:
- Matches PR review patterns familiar to developers
- Outdated comments shown with visual distinction (gray background, "outdated" badge)
- Replies indented under parent

### 4. API Surface Decisions

#### Comparison Snapshot Endpoint
**Decision**: Add `GET /api/v1/branches/:id/comparison` endpoint
**Response**:
```typescript
{
  baseCommit: string;
  headCommit: string;
  files: FileDiff[];
  stats: { filesChanged: number; additions: number; deletions: number };
  baseState: 'current' | 'diverged';  // Indicates if main has moved
  divergedCommit?: string;  // If diverged, the commit main moved to
}
```
**Rationale**: Single endpoint for all comparison needs; includes divergence detection per FR-003 and edge case "base state divergence".

#### Review Decision Endpoint Enhancement
**Decision**: Enhance existing `/api/v1/reviews/:id/approve` and `/api/v1/reviews/:id/request-changes`
**Changes**:
- Add optional `inlineComments: ReviewComment[]` to submit inline feedback with decision
- Response includes updated review state and branch state
**Rationale**: Atomic decision + comments submission prevents inconsistent state.

#### Comment Outdating Endpoint
**Decision**: Add `POST /api/v1/reviews/:id/refresh-comments` endpoint
**Behavior**:
- Called when branch content changes post-review-submission
- Compares comment anchors against current diff
- Marks comments as outdated if anchored content changed
- Returns updated comments array
**Rationale**: Explicit refresh rather than automatic to give control over when outdating happens.

### 5. Review State Sub-states

**Decision**: Model review sub-states as metadata rather than XState extension
**Rationale**:
- Spec defines sub-states (Pending Review, In Discussion, Changes Requested, Approved)
- These map to queryable conditions on review records rather than branch state
- Branch state remains simple: draft → review → approved
- Sub-state derived: `reviews.some(r => r.decision === 'changes_requested')` → "Changes Requested"

**State Derivation Logic**:
```typescript
function getReviewSubState(reviews: Review[]): ReviewSubState {
  const activeReviews = reviews.filter(r => r.status !== 'cancelled');
  if (activeReviews.some(r => r.decision === 'changes_requested')) {
    return 'changes_requested';
  }
  if (activeReviews.every(r => r.decision === 'approved')) {
    return 'approved';
  }
  if (activeReviews.some(r => r.comments?.length > 0)) {
    return 'in_discussion';
  }
  return 'pending_review';
}
```

### 6. Notification Integration

**Decision**: Extend existing notification service with review-specific triggers
**New Notification Types**:
```typescript
export const NotificationType = {
  ...existing,
  REVIEW_COMMENT_ADDED: 'review_comment_added',
  REVIEW_COMMENT_REPLY: 'review_comment_reply',
  REVIEW_DECISION_MADE: 'review_decision_made',
} as const;
```
**Triggers**:
- Review submitted → Notify all assigned reviewers
- Comment added → Notify branch owner and other reviewers
- Reply added → Notify parent comment author
- Decision made → Notify branch owner

**Rationale**: Existing `/backend/src/services/notification/notification-service.ts` has `createBulk()` method ready for multi-recipient notifications.

### 7. Transition Strategy (Dashboard → In-Context)

**Decision**: Parallel availability with progressive migration
**Phase 1**:
- Add in-context review to Library page
- Dashboard continues to work
- Add "View in Context" link from dashboard review cards

**Phase 2**:
- In-context becomes primary entry point
- Dashboard review section shows summary with "Open Review" link
- Dashboard retains list/filter capabilities

**Phase 3** (future):
- Dashboard review section deprecated
- All review actions route to in-context

**Rationale**: Non-breaking migration preserves user workflows while encouraging adoption.

### 8. Permission Model

**Decision**: Leverage existing role-based permission checks
**Review Context Permissions**:
```typescript
interface ReviewPermissions {
  canViewReview: boolean;      // reviewer, contributor (owner), admin
  canAddComment: boolean;      // reviewer, contributor (owner), admin
  canApprove: boolean;         // reviewer only (not owner)
  canRequestChanges: boolean;  // reviewer only (not owner)
  canWithdraw: boolean;        // contributor (owner) only
  canReassignReviewers: boolean; // contributor (owner), admin
}
```
**Rationale**: Maps directly to FR-013a (contributors cannot self-approve) and existing RBAC patterns.

### 9. Edge Cases Analysis

| Edge Case | Resolution | Implementation |
|-----------|------------|----------------|
| Base state divergence | Show "base has changed" warning; review continues against original snapshot | `comparison.baseState === 'diverged'` triggers UI warning |
| Unresponsive reviewer | No auto-expire; owner can remove/reassign | Existing reviewer removal flow handles this |
| Comment on deleted content | Mark as orphaned, preserve with "content deleted" note | `isOutdated: true, outdatedReason: 'referenced content deleted'` |
| Conflicting decisions | Any "changes requested" blocks approval until addressed | State derivation logic handles; UI shows blocking status |
| Concurrent reviewer activity | Optimistic UI with conflict resolution on save | Standard optimistic update pattern + refetch on mutation |
| Reviewer deactivated | Admin must reassign before review can proceed | Guard prevents completion without active reviewer |

### 10. Performance Considerations

**Decision**: Implement chunked diff loading and comment virtualization
**Thresholds**:
- Files > 500 lines: Load diff on demand (collapsed by default)
- Total diff > 2000 lines: Paginate files
- Comments > 50: Virtualized list rendering

**Rationale**: Spec requires 5-second comparison load time (SC-002); large diffs without chunking can exceed this.

## Unknowns Resolved

| Unknown | Resolution |
|---------|------------|
| Where to render in-context review | Library page with `mode=review` URL param |
| How to handle thread depth | Max 2 levels (comment + replies); further replies go flat |
| Snapshot storage format | Git commit references + cached JSONB summary |
| Outdated comment detection | Explicit refresh endpoint comparing anchors to current diff |
| Multiple approval threshold | Already implemented via `requiredApprovals` field (FR-002a) |

## Dependencies and Integration Points

1. **Git service** (`/backend/src/services/git/`): Diff generation, commit references
2. **Review service** (`/backend/src/services/review/`): Core review operations
3. **Notification service** (`/backend/src/services/notification/`): Review event notifications
4. **State machine** (`/backend/src/services/workflow/`): Branch state transitions
5. **Audit service** (`/backend/src/services/audit/`): Review action logging

## Next Steps

With research complete, proceed to Phase 1:
1. Generate `data-model.md` with entity definitions
2. Generate API contracts in `/contracts/`
3. Generate `quickstart.md` for implementation guidance
