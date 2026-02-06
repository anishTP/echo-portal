# Implementation Plan: In-Context Review and Approval Workflow

**Branch**: `006-review-approval` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-review-approval/spec.md`

## Summary

This feature implements an in-context review and approval experience that allows reviewers to evaluate, discuss, and decide on proposed changes directly within the content library view. The implementation extends the existing review infrastructure with:

1. **Diff-first review experience** - Comparison snapshots captured at submission, rendered inline with file-level navigation
2. **Inline commenting** - Comments anchored to specific diff lines with threading support and outdated tracking
3. **Unified review decision surface** - Approve/request-changes actions colocated with diff and feedback
4. **Review state awareness** - Clear visual cues for review status, approval progress, and blocking conditions

Technical approach leverages existing XState state machine, Drizzle ORM, and React component patterns while adding new comparison, snapshot, and enhanced comment capabilities.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 (frontend), Drizzle ORM 0.44.0, XState 5.19.2, Zod 3.24.2
**Storage**: PostgreSQL (existing Drizzle schema) + new `review_snapshots` table
**Testing**: Vitest (backend integration), React Testing Library (frontend)
**Target Platform**: Web application (modern browsers)
**Project Type**: Web application (monorepo with backend + frontend)
**Performance Goals**: 5-second comparison load (SC-002), 30-second submission (SC-001)
**Constraints**: In-context (no navigation away from library), preserve existing review API compatibility
**Scale/Scope**: Support diffs up to 2000 lines with chunking, 50+ comments per review

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All review decisions (approve, request changes) are explicit user actions with required attribution. Comments are explicit feedback tied to authenticated users. No silent state changes.

- [x] **Single Source of Truth (II)**: Comparison snapshots preserve the exact state at submission time. Published content remains protected; reviews occur in branch isolation.

- [x] **Branch-First Collaboration (III)**: Review is a defined lifecycle stage (Draft → Review → Approved). Branch becomes immutable during review. Changes requested returns to Draft for iteration.

- [x] **Separation of Concerns (IV)**: Review is a contribution flow requiring authentication. Published content viewing remains open. Clear read/write boundaries maintained.

- [x] **Role-Driven Governance (V)**: Spec defines explicit permissions per role (Contributor, Reviewer, Administrator). Self-approval prevention enforced. All actions attributed.

- [x] **Open by Default (VI)**: Reviews are private to participants during review. After publication, audit trail shows review occurred (actors, timestamps, outcomes) but comment text remains private.

- [x] **Layered Architecture (VII)**: Extends existing review service and state machine. New snapshot service is additive. Core workflows unchanged. API versioned.

- [x] **Specification Completeness (VIII)**: Spec includes all required sections: Actors/Permissions table, Lifecycle States diagram, Visibility Boundaries table, Audit Events list, Success Criteria, Verification Requirements.

- [x] **Clarity Over Breadth (IX)**: Single-purpose components (DiffView, ReviewOverlay). Threading limited to 2 levels. No over-engineering. See Complexity Tracking for justified additions.

- [x] **Testing as Contract (X)**: Integration tests defined for all API endpoints. Frontend component tests specified. Acceptance scenarios from spec map to test cases.

## Project Structure

### Documentation (this feature)

```text
specs/006-review-approval/
├── plan.md              # This file
├── research.md          # Phase 0 output - technical decisions and unknowns resolution
├── data-model.md        # Phase 1 output - entity definitions and schema
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output
│   └── review-api.yaml  # OpenAPI specification for review endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── reviews.ts          # Extended with snapshot, decision endpoints
│   │       └── comparison.ts       # NEW: Comparison endpoints
│   ├── db/
│   │   ├── schema/
│   │   │   └── review-snapshots.ts # NEW: Snapshot table schema
│   │   └── migrations/
│   │       ├── XXXX_add_review_snapshots.ts
│   │       └── XXXX_add_review_cycle.ts
│   ├── services/
│   │   ├── review/
│   │   │   ├── review-service.ts   # Extended with cycle tracking
│   │   │   ├── comments.ts         # Extended with threading, outdating
│   │   │   ├── snapshot-service.ts # NEW: Snapshot creation/retrieval
│   │   │   ├── comparison-service.ts # NEW: Diff comparison logic
│   │   │   └── review-notifications.ts # NEW: Review event notifications
│   │   └── git/
│   │       ├── diff.ts             # Extended with hunk IDs
│   │       └── diff-format.ts      # Existing (unchanged)
│   └── models/
│       └── review.ts               # Extended types
└── tests/
    └── integration/
        └── in-context-review.test.ts # NEW: Review integration tests

frontend/
├── src/
│   ├── components/
│   │   └── review/
│   │       ├── ReviewOverlay.tsx    # NEW: Main in-context review container
│   │       ├── DiffView.tsx         # NEW: Diff rendering with comments
│   │       ├── DiffFileHeader.tsx   # NEW: File header with expand/collapse
│   │       ├── DiffHunk.tsx         # NEW: Hunk rendering with line highlighting
│   │       ├── InlineCommentForm.tsx # NEW: Add comment form
│   │       ├── CommentThread.tsx    # NEW: Threaded comment display
│   │       ├── ReviewDecisionPanel.tsx # NEW: Approve/request changes UI
│   │       ├── ReviewStatusHeader.tsx # NEW: Status bar with progress
│   │       ├── ReviewCommentsSidebar.tsx # NEW: All comments list
│   │       ├── ReviewPanel.tsx      # Existing (minor updates)
│   │       └── BranchReviewSection.tsx # Existing (add "Open in Context" link)
│   ├── context/
│   │   └── ReviewContext.tsx        # NEW: Review state provider
│   ├── hooks/
│   │   ├── useComparison.ts         # NEW: Comparison data hook
│   │   ├── useReviewComments.ts     # NEW: Comments with threading
│   │   └── useReview.ts             # Existing (minor updates)
│   ├── pages/
│   │   └── Library.tsx              # Extended with review mode
│   └── services/
│       ├── reviewService.ts         # Extended with new endpoints
│       └── comparisonService.ts     # NEW: Comparison API client
└── tests/
    └── components/
        └── DiffView.test.tsx        # NEW: Diff component tests

shared/
└── types/
    ├── review.ts                    # Extended with snapshot, comment types
    └── comparison.ts                # NEW: Comparison type definitions
```

**Structure Decision**: Web application structure (Option 2) with backend/frontend separation. Follows existing Echo Portal monorepo patterns. New files added to existing directory structure where applicable.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| ReviewSnapshot table | Preserve exact comparison state at submission time for audit compliance (FR-003) | Storing in reviews JSONB rejected: potential size issues, query performance for large diffs |
| ReviewContext provider | Centralize review state across multiple components (DiffView, Comments, Decisions) | Prop drilling rejected: 5+ component levels, frequent updates would cause unnecessary re-renders |
| Comment threading (2 levels) | Enable conversation flow between reviewer and contributor (FR-008) | Flat comments rejected: loses discussion context, harder to follow back-and-forth |
| Hunk IDs for comment anchoring | Stable reference for line-level comments that survives minor diff regeneration | Line numbers only rejected: shift when code above changes, making comments orphaned |

## Implementation Phases

### Phase 1: Backend Foundation (Completed in Plan)
- [x] Database migrations (review_snapshots, review_cycle)
- [x] Snapshot service for comparison preservation
- [x] Comparison service for diff retrieval
- [x] Enhanced comment service with threading
- [x] API contracts defined (OpenAPI)

### Phase 2: API Layer
- [ ] Comparison endpoints implementation
- [ ] Snapshot endpoints implementation
- [ ] Enhanced review decision endpoints
- [ ] Comment threading endpoints
- [ ] Review status endpoint

### Phase 3: Frontend Components
- [ ] ReviewContext provider
- [ ] DiffView component with line rendering
- [ ] CommentThread component
- [ ] ReviewDecisionPanel component
- [ ] ReviewOverlay container

### Phase 4: Integration
- [ ] Library page review mode
- [ ] Notification triggers
- [ ] Dashboard "Open in Context" links
- [ ] Transition strategy implementation

### Phase 5: Testing & Polish
- [ ] Integration tests for all endpoints
- [ ] Frontend component tests
- [ ] Performance testing (5s comparison load)
- [ ] Accessibility review
- [ ] Documentation updates

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large diff performance | Chunked loading (500 lines/file), lazy file expansion, virtual scrolling for comments |
| Comment anchor stability | Hunk IDs + line context comparison; graceful outdated marking when anchors shift |
| State complexity | ReviewContext centralizes state; XState guards prevent invalid transitions |
| Migration safety | Additive schema changes; new table with FK cascade; rollback scripts |

## Dependencies

- **Existing**: review service, diff service, notification service, state machine
- **External**: None (no new external dependencies)

## Success Metrics Mapping

| Metric | Implementation |
|--------|----------------|
| SC-002: 5s comparison load | Chunked diff loading, indexed queries |
| SC-003: 100% recorded outcomes | Required decision on completion, audit logging |
| SC-005: 100% rejection without approval | Guard on convergence requiring approved state |
| SC-006: Zero missed modifications | Snapshot captures full diff at submission |

## Artifacts Generated

1. **research.md** - Technical decisions, unknowns resolution, architecture analysis
2. **data-model.md** - Entity definitions, schema migrations, type definitions
3. **contracts/review-api.yaml** - OpenAPI 3.1 specification for all new endpoints
4. **quickstart.md** - Step-by-step implementation guide with code examples
