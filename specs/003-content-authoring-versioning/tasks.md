# Tasks: Content Authoring and Versioning

**Feature**: `specs/003-content-authoring-versioning/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `{epic-id}` |
| **Spec Label** | `spec:003-content-authoring-versioning` |
| **User Stories Source** | `specs/003-content-authoring-versioning/spec.md` |
| **Planning Details** | `specs/003-content-authoring-versioning/plan.md` |
| **Data Model** | `specs/003-content-authoring-versioning/data-model.md` |

> **NOTE**: Run the Beads Issue Creation Script (at end of file) after generating this tasks.md to create the epic and phase issues in beads.

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Content Authoring and Versioning |
| **User Stories** | 5 from spec.md |
| **Priority** | P1 (MVP) -> P2 -> P3 -> P4 -> P5 |
| **Est. Tasks** | 72 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.0:
- Testing as Contract (X): Tests written before implementation (TDD)
- Explicit Change Control (I): All changes attributable and intentional
- Specification Completeness (VIII): All mandatory sections verified in spec.md
- Clarity Over Breadth (IX): Complexity justified in plan.md

Refer to `.specify/memory/constitution.md` for full principles.

---

## Status Reference

| Icon | Status | Description |
|------|--------|-------------|
| ⬜ | Pending | Not started |
| 🔄 | In Progress | Work underway |
| ✅ | Completed | Done and verified |
| ⚠️ | Blocked | Waiting on dependency |
| 🎯 | MVP | Core deliverable |

---

## Task Format

```
- [ ] T001 [P] [US1] Description `path/to/file.ext`
```

| Element | Meaning |
|---------|---------|
| `T001` | Task ID (sequential) |
| `[P]` | Parallelizable (different files, no blocking deps) |
| `[US1]` | User Story reference |
| `` `path` `` | Exact file path(s) affected |

---

## Query Hints

### Markdown Queries (grep)

```bash
# Filter by phase
grep -E "^- \[ \].*Phase 1" tasks.md

# Filter by user story
grep -E "\[US1\]" tasks.md

# Find parallelizable tasks
grep -E "\[P\]" tasks.md

# Find blocked tasks
grep -E "blocked" tasks.md

# Count remaining tasks
grep -c "^- \[ \]" tasks.md
```

### Beads Queries (bd CLI)

> **NOTE**: View comments when working on tasks - implementation details are documented there.

```bash
# All open tasks for this feature
bd list --label 'spec:003-content-authoring-versioning' --status open --limit 20

# Task tree from epic
bd dep tree --reverse {epic-id}

# Ready tasks (no blockers)
bd ready --limit 5

# By phase
bd list --label 'phase:setup' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:foundational' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:us1' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:us2' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:us3' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:us4' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:us5' --label 'spec:003-content-authoring-versioning'
bd list --label 'phase:polish' --label 'spec:003-content-authoring-versioning'

# By component
bd list --label 'component:backend' --label 'spec:003-content-authoring-versioning'
bd list --label 'component:frontend' --label 'spec:003-content-authoring-versioning'

# Task details and comments
bd show {id}
bd comments {id}
```

---

## Path Conventions

Full-stack web monorepo layout per plan.md:

| Layer | Source | Components | Tests |
|-------|--------|------------|-------|
| Backend | `backend/src/` | `backend/src/services/`, `backend/src/api/` | `backend/tests/` |
| Frontend | `frontend/src/` | `frontend/src/components/` | `frontend/src/__tests__/` |
| Shared | `shared/` | `shared/types/`, `shared/constants/` | — |

---

## Phase 1: Setup — ✅ Completed (2026-01-27)

**Beads Phase ID**: `echo-portal-1p4` — CLOSED
**Purpose**: Database schema, shared types, new dependencies
**Blocks**: All subsequent phases
**Completed Tasks**: T001-T010

- [x] T001 [P] Create `content_type_enum` and `contents` table schema in `backend/src/db/schema/contents.ts`
- [x] T002 [P] Create `content_versions` table schema in `backend/src/db/schema/contents.ts`
- [x] T003 [P] Create `content_references` table schema in `backend/src/db/schema/contents.ts`
- [x] T004 [P] Create `notifications` table schema in `backend/src/db/schema/notifications.ts`
- [x] T005 Export new schemas from `backend/src/db/schema/index.ts`
- [x] T006 [P] Create shared Content, ContentVersion, ContentReference interfaces in `shared/types/content.ts`
- [x] T007 [P] Create shared Notification interfaces in `shared/types/notification.ts`
- [x] T008 [P] Add content-specific state constants (content types, body formats, reference types) in `shared/constants/states.ts`
- [x] T009 Generate and apply Drizzle migration via `pnpm db:generate && pnpm db:push`
- [x] T010 [P] Create immutability trigger migration (BEFORE UPDATE OR DELETE on `content_versions` for published content) as custom Drizzle SQL migration in `backend/drizzle/`

**Checkpoint**: Migration generated, shared package builds cleanly, new schemas compile without errors

---

## Phase 2: Foundational — ✅ Completed (2026-01-27)

**Beads Phase ID**: `echo-portal-m3z` — CLOSED
**Purpose**: Core service layer infrastructure ALL user stories depend on
**Completed Tasks**: T011-T019

- [x] T011 [P] Create content Zod validation schemas (create, update, revert requests) in `backend/src/api/schemas/contents.ts`
- [x] T012 [P] Create content model with slug generation and validation in `backend/src/models/content.ts`
- [x] T013 [P] Add content-specific permissions (`content:create`, `content:read`, `content:update`, `content:revert`, `content:publish`, `content:archive`, `content:search`) to RBAC middleware in `backend/src/api/middleware/permissions.ts`
- [x] T014 [P] Create ContentService skeleton (create, update, getById, listByBranch, listPublished, search) in `backend/src/services/content/content-service.ts`
- [x] T015 [P] Create VersionService skeleton (createVersion, getVersions, getVersion, revert) in `backend/src/services/content/version-service.ts`
- [x] T016 [P] Create service index exports in `backend/src/services/content/index.ts`
- [x] T017 [P] Create content API client functions in `frontend/src/services/content-api.ts`
- [x] T018 [P] Create content Zustand store (currentContent, versions, isDirty, isLoading) in `frontend/src/stores/contentStore.ts`
- [x] T019 [P] Create notification Zustand store (unreadCount, notifications) in `frontend/src/stores/notificationStore.ts`

**Checkpoint**: Service skeletons compile, Zod schemas validate, stores initialize without errors

---

## Phase 3: User Story 1 — Create New Content Contribution (P1) MVP — ✅ Completed (2026-01-27)

**Beads Phase ID**: `echo-portal-5mt` — CLOSED
**Goal**: Contributors can create new content within a branch with attribution, versioning, and metadata
**Completed Tasks**: T020-T032

### Backend

- [x] T020 [US1] Implement `ContentService.create()` in `backend/src/services/content/content-service.ts`
- [x] T021 [US1] Implement `VersionService.createVersion()` in `backend/src/services/content/version-service.ts`
- [x] T022 [US1] Implement `ContentService.getById()` in `backend/src/services/content/content-service.ts`
- [x] T023 [US1] Implement `ContentService.listByBranch()` in `backend/src/services/content/content-service.ts`
- [x] T024 [P] [US1] Implement POST `/api/v1/contents` route in `backend/src/api/routes/contents.ts`
- [x] T025 [P] [US1] Implement GET `/api/v1/contents/:id` route in `backend/src/api/routes/contents.ts`
- [x] T026 [P] [US1] Implement GET `/api/v1/contents?branchId=X` route in `backend/src/api/routes/contents.ts`

### Frontend

- [x] T027 [P] [US1] Create `useContent(id)` and `useContentList(branchId)` React Query hooks in `frontend/src/hooks/useContent.ts`
- [x] T028 [P] [US1] Create ContentTypeSelector component in `frontend/src/components/content/ContentTypeSelector.tsx`
- [x] T029 [P] [US1] Create ContentMetadata component in `frontend/src/components/content/ContentMetadata.tsx`
- [x] T030 [US1] Create ContentEditor component in `frontend/src/components/content/ContentEditor.tsx`
- [x] T031 [US1] Create ContentList component in `frontend/src/components/content/ContentList.tsx`
- [x] T032 [US1] Content component index exports in `frontend/src/components/content/index.ts`

**Checkpoint**: US1 implemented — API routes, services, hooks, and components for content CRUD.

---

## Phase 4: User Story 2 — Modify and Version Existing Content (P2) — ✅ Completed (2026-01-27)

**Beads Phase ID**: `echo-portal-ceb` — CLOSED
**Goal**: Contributors can modify content with immutable versions, view history, compare, revert
**Completed Tasks**: T033-T046

### Backend

- [x] T033 [US2] Implement `ContentService.update()` in `backend/src/services/content/content-service.ts`
- [x] T034 [US2] Implement `VersionService.getVersions()` in `backend/src/services/content/version-service.ts`
- [x] T035 [US2] Implement `VersionService.getVersion()` in `backend/src/services/content/version-service.ts`
- [x] T036 [US2] Implement `VersionService.revert()` in `backend/src/services/content/version-service.ts`
- [x] T037 [US2] Implement DiffService (LCS line-based diff) in `backend/src/services/content/diff-service.ts`
- [x] T038-T042 All content routes implemented in `backend/src/api/routes/contents.ts`

### Frontend

- [x] T043 [US2] Create `useVersionHistory` hooks in `frontend/src/hooks/useVersionHistory.ts`
- [x] T044 [US2] Create VersionHistory component in `frontend/src/components/content/VersionHistory.tsx`
- [x] T045 [US2] Create VersionDiff component in `frontend/src/components/content/VersionDiff.tsx`
- [x] T046 [US2] Content component exports updated

---

## Phase 5: User Story 3 — Submit Content for Review (P3) — ⬜ Pending

**Beads Phase ID**: `{phase-5-id}`
**Goal**: Content transitions to review state with reviewer notifications (in-app + email)
**Acceptance**: Submit branch for review, verify notifications dispatched and content is in review state
**Dependencies**: Phase 2 complete, US1 (content must exist to submit for review)
**Covers**: FR-004, FR-013, FR-022, FR-023

### Backend

- [ ] T047 [US3] Create NotificationService — `notifyReviewRequested()`, `notifyReviewCompleted()`, `notifyContentPublished()`, `getNotifications()`, `markRead()`, email dispatch (nodemailer, async fire-and-forget with error logging) in `backend/src/services/notification/notification-service.ts`
- [ ] T048 [P] [US3] Create notification service exports in `backend/src/services/notification/index.ts`
- [ ] T049 [US3] Extend XState BranchMachine with `hasContentInBranch` guard (validates branch has at least one content item before SUBMIT_FOR_REVIEW) in `backend/src/services/workflow/state-machine.ts`
- [ ] T050 [US3] Wire NotificationService to review submission — dispatch in-app + email notifications to assigned reviewers on branch state transition to Review in `backend/src/services/workflow/state-machine.ts`
- [ ] T051 [P] [US3] Implement GET `/api/v1/notifications` route — pagination, read/unread filter, type filter in `backend/src/api/routes/notifications.ts`
- [ ] T052 [P] [US3] Implement PATCH `/api/v1/notifications/:id/read` route in `backend/src/api/routes/notifications.ts`
- [ ] T053 [P] [US3] Implement GET `/api/v1/notifications/unread-count` route in `backend/src/api/routes/notifications.ts`

### Frontend

- [ ] T054 [P] [US3] Create `useNotifications()` React Query hook with 30-second polling interval in `frontend/src/hooks/useNotifications.ts`
- [ ] T055 [US3] Create NotificationBell component (bell icon in header with unread count badge) in `frontend/src/components/notification/NotificationBell.tsx`
- [ ] T056 [US3] Create NotificationList component (dropdown panel with recent notifications, click to navigate, mark as read) in `frontend/src/components/notification/NotificationList.tsx`
- [ ] T057 [US3] Integrate NotificationBell into AppHeader in `frontend/src/pages/BranchWorkspace.tsx` or equivalent layout component

**Checkpoint**: US3 functional — submit branch for review triggers in-app and email notifications to reviewers. Notification bell shows unread count and notification list.

---

## Phase 6: User Story 4 — Publish Approved Content (P4) — ⬜ Pending

**Beads Phase ID**: `{phase-6-id}`
**Goal**: Approved content can be published, becoming immutable and publicly accessible with full lineage
**Acceptance**: Publish approved content, verify immutability, public access, and lineage chain
**Dependencies**: Phase 2 complete, US3 (content must go through review to reach Approved state)
**Covers**: FR-004, FR-005, FR-013, FR-014, FR-018

### Backend

- [ ] T058 [US4] Implement `ContentService.markPublished()` — set `is_published=true`, `published_at`, `published_by`, `published_version_id` on all content items in published branch in `backend/src/services/content/content-service.ts`
- [ ] T059 [US4] Implement `ContentService.markArchived()` — set `archived_at` on all content items in archived branch in `backend/src/services/content/content-service.ts`
- [ ] T060 [US4] Extend XState BranchMachine with PUBLISH action to trigger `ContentService.markPublished()` and ARCHIVE action to trigger `ContentService.markArchived()` in `backend/src/services/workflow/state-machine.ts`
- [ ] T061 [US4] Implement published content immutability enforcement — `ContentService.update()` returns 403 if `content.is_published === true` or branch is in published/archived state in `backend/src/services/content/content-service.ts`
- [ ] T062 [P] [US4] Implement GET `/api/v1/contents/published` route — public access, pagination, type/category filtering in `backend/src/api/routes/contents.ts`
- [ ] T063 [US4] Implement `ContentService.listPublished()` — no auth required for public visibility, authenticated users see team/private content per RBAC in `backend/src/services/content/content-service.ts`
- [ ] T064 [P] [US4] Implement GET `/api/v1/contents/:id/lineage` route — return full version chain + source content if exists in `backend/src/api/routes/contents.ts`
- [ ] T065 [US4] Wire publication notification via NotificationService — notify stakeholders when content is published in `backend/src/services/content/content-service.ts`

### Frontend

- [ ] T066 [US4] Create ContentLineage component (visual lineage from published version back to origin branch, authors, reviewers) in `frontend/src/components/content/ContentLineage.tsx`
- [ ] T067 [US4] Add published content read-only view mode to ContentEditor (disable editing, show published badge) in `frontend/src/components/content/ContentEditor.tsx`

**Checkpoint**: US4 functional — publish approved content, verify immutability (modification attempts blocked), public access works, full lineage displayed.

---

## Phase 7: User Story 5 — Access Historical Versions for Audit (P5) — ⬜ Pending

**Beads Phase ID**: `{phase-7-id}`
**Goal**: Administrators and auditors can access and compare any historical version with complete metadata
**Acceptance**: Access historical content across time periods, compare versions, verify all metadata preserved
**Dependencies**: Phase 2 complete, US2 (version history must exist)
**Covers**: FR-010, FR-011, FR-016, FR-017, FR-020

### Backend

- [ ] T068 [US5] Implement `ContentService.search()` — full-text search across title, description, tags, category including archived content in `backend/src/services/content/content-service.ts`
- [ ] T069 [P] [US5] Implement GET `/api/v1/contents/search?q=X` route — optional auth, type filtering, pagination in `backend/src/api/routes/contents.ts`
- [ ] T070 [US5] Implement ReferenceService — `recordReferences()`, `getReferences()`, `getReferencedBy()`, `validateReferences()` in `backend/src/services/content/reference-service.ts`
- [ ] T071 [P] [US5] Implement GET `/api/v1/contents/:id/references` route in `backend/src/api/routes/contents.ts`
- [ ] T072 [P] [US5] Implement GET `/api/v1/contents/:id/referenced-by` route in `backend/src/api/routes/contents.ts`

**Checkpoint**: US5 functional — search across all content including archived, view complete references, all historical versions accessible with metadata.

---

## Phase 8: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `{phase-8-id}`
**Purpose**: Performance optimization, edge cases, conflict detection, end-to-end validation
**Dependencies**: All desired user stories complete

- [ ] T073 [P] Add `contentNotExceedsSize` guard to XState BranchMachine — validate no content exceeds 50 MB before SUBMIT_FOR_REVIEW in `backend/src/services/workflow/state-machine.ts`
- [ ] T074 [P] Implement conflict detection for convergence — detect when source content has been modified by another branch since fork, require manual resolution (FR-018, FR-021) in `backend/src/services/content/content-service.ts`
- [ ] T075 [P] Add frontend size validation before upload (fast feedback for 50 MB limit) in `frontend/src/components/content/ContentEditor.tsx`
- [ ] T076 [P] Add optimistic concurrency conflict dialog to ContentEditor — show "Overwrite", "View diff", "Cancel" options on 409 Conflict in `frontend/src/components/content/ContentEditor.tsx`
- [ ] T077 [P] Performance optimization — ensure content body excluded from list queries, add pagination defaults, verify index usage for high-frequency queries in `backend/src/services/content/content-service.ts`
- [ ] T078 [P] Wire audit logging for all content lifecycle events (create, modify, state transitions, review actions, publication, access, archival) in `backend/src/services/content/content-service.ts`
- [ ] T079 Run `quickstart.md` validation end-to-end — verify all API workflows from quickstart guide work correctly
- [ ] T080 Verify contract compliance — all API responses match OpenAPI schemas in `specs/003-content-authoring-versioning/contracts/`

**Checkpoint**: Feature complete, all edge cases handled, performance targets met, contract-compliant, production-ready.

---

## Dependency Graph

```
Phase 1: Setup (DB Schema + Shared Types)
    |
    v
Phase 2: Foundational (Services + Stores + Middleware) ──────────────┐
    |                                                                 |
    ├────────────────┬────────────────┐                               |
    v                v                v                               |
Phase 3: US1     Phase 4: US2     Phase 7: US5                       |
(P1 MVP 🎯)      (P2)             (P5)                               |
Create Content   Modify/Version   Search/Audit                       |
    |                                                                 |
    v                                                                 |
Phase 5: US3 ────────────┐                                           |
(P3) Submit              |                                           |
for Review               |                                           |
    |                    |                                           |
    v                    |                                           |
Phase 6: US4             |                                           | (parallel where noted)
(P4) Publish             |                                           |
    |                    |                                           |
    └────────────────────┘                                           |
                    |                                                 |
                    v                                                 |
            Phase 8: Polish ◄────────────────────────────────────────┘
```

### Key Rules

1. **Setup** -> No dependencies, start immediately
2. **Foundational** -> Blocks ALL user stories
3. **US1 (P1)** -> MVP target; can run in parallel with US2 and US5 after Phase 2
4. **US2 (P2)** -> Can run in parallel with US1 after Phase 2
5. **US3 (P3)** -> Depends on US1 (content must exist to submit for review)
6. **US4 (P4)** -> Depends on US3 (content must go through review to reach Approved)
7. **US5 (P5)** -> Can run in parallel with US1/US2 after Phase 2
8. **Within each story**: Services -> Routes -> Frontend components
9. **Polish** -> After all desired stories complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup -> Foundational -> US1 (MVP) -> STOP & VALIDATE -> [US2 -> US3 -> US4 -> US5 -> Polish]
```

Ship after US1 if viable. Content creation + listing is the minimum viable feature.

### Strategy B: Parallel Team

```
All: Setup -> Foundational
Then split:
  Dev A: US1 (P1) -> US3 (P3, depends on US1) -> US4 (P4, depends on US3)
  Dev B: US2 (P2) + US5 (P5) in parallel
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup -> Foundational -> US1 -> US2 -> US3 -> US4 -> US5 -> Polish
```

One story at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004 & T006 & T007 & T008 & T010
wait
# Then sequential
T005  # Export depends on T001-T004
T009  # Migration depends on all schema files
```

### Within Foundational Phase

```bash
# All [P] tasks in parallel
T011 & T012 & T013 & T014 & T015 & T016 & T017 & T018 & T019
wait
```

### Within US1 (Phase 3)

```bash
# Backend services (sequential - update depends on create)
T020 -> T021 -> T022 -> T023
# Backend routes (parallel after services)
T024 & T025 & T026
wait
# Frontend (parallel)
T027 & T028 & T029
wait
# Frontend (sequential - depends on components)
T030 -> T031 -> T032
```

### Across User Stories

```bash
# After Foundational complete, US1, US2, and US5 in parallel
(Phase 3: US1) & (Phase 4: US2) & (Phase 7: US5)
wait
# US3 after US1
(Phase 5: US3)
wait
# US4 after US3
(Phase 6: US4)
wait
# Then Polish
(Phase 8: Polish)
```

---

## Completion Tracking

### Task Completion (Markdown + Beads)

```markdown
- [x] T001 [P] Description `path/file.ext` — (2026-01-27)
```

```bash
# Update beads when completing a task
bd update {task-id} --status in_progress  # Before starting
bd close {task-id} --reason "Implemented {file}"  # After completion
bd sync  # Sync changes
```

### Phase Completion

```markdown
## Phase 1: Setup — COMPLETED (2026-01-27)

**Beads Phase ID**: `{phase-1-id}` — CLOSED
**Completed Tasks**: T001-T010
```

```bash
# Close phase in beads
bd close {phase-1-id} --reason "All setup tasks complete"
bd sync
```

### Story Completion

```markdown
## Phase 3: User Story 1 — Create New Content Contribution (P1) MVP — COMPLETED (2026-01-27)

**Beads Phase ID**: `{phase-3-id}` — CLOSED
**Acceptance Verified**: Content creation + listing + editor working in branch context
**Completed Tasks**: T020-T032
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **Avoid**: Vague tasks, same-file conflicts, cross-story dependencies that break independence
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state
- **Tech stack**: TypeScript 5.9+, Hono 4.8.2, React 19, Drizzle ORM 0.44.0, XState 5.19.2, Zod 3.24.2, Monaco Editor, TanStack React Query, Zustand, Vitest

---

## Beads Issue Creation Script

Run this script after generating tasks.md to create the epic and phase structure in beads:

```bash
#!/bin/bash
FEATURE="003-content-authoring-versioning"
FEATURE_TITLE="Content Authoring and Versioning"
LABEL="spec:${FEATURE}"

# Create epic
EPIC=$(bd create "$FEATURE_TITLE" -t epic -p 1 -l "$LABEL" --json | jq -r '.id')
echo "Created Epic: $EPIC"

# Create phases
P1=$(bd create "Phase 1: Setup (DB Schema + Shared Types)" -t feature -p 1 -l "$LABEL,phase:setup" --parent $EPIC --json | jq -r '.id')
P2=$(bd create "Phase 2: Foundational (Services + Stores + Middleware)" -t feature -p 1 -l "$LABEL,phase:foundational" --parent $EPIC --json | jq -r '.id')
P3=$(bd create "Phase 3: US1 - Create New Content (MVP)" -t feature -p 1 -l "$LABEL,phase:us1" --parent $EPIC --json | jq -r '.id')
P4=$(bd create "Phase 4: US2 - Modify and Version Content" -t feature -p 2 -l "$LABEL,phase:us2" --parent $EPIC --json | jq -r '.id')
P5=$(bd create "Phase 5: US3 - Submit for Review" -t feature -p 3 -l "$LABEL,phase:us3" --parent $EPIC --json | jq -r '.id')
P6=$(bd create "Phase 6: US4 - Publish Approved Content" -t feature -p 3 -l "$LABEL,phase:us4" --parent $EPIC --json | jq -r '.id')
P7=$(bd create "Phase 7: US5 - Historical Versions for Audit" -t feature -p 3 -l "$LABEL,phase:us5" --parent $EPIC --json | jq -r '.id')
PN=$(bd create "Phase 8: Polish & Cross-Cutting" -t feature -p 4 -l "$LABEL,phase:polish" --parent $EPIC --json | jq -r '.id')

echo "Created Phases: P1=$P1, P2=$P2, P3=$P3, P4=$P4, P5=$P5, P6=$P6, P7=$P7, PN=$PN"

# Set phase dependencies
bd dep add $P2 $P1  # Foundational depends on Setup
bd dep add $P3 $P2  # US1 depends on Foundational
bd dep add $P4 $P2  # US2 depends on Foundational (parallel with US1)
bd dep add $P5 $P3  # US3 depends on US1 (content must exist)
bd dep add $P6 $P5  # US4 depends on US3 (review must happen first)
bd dep add $P7 $P2  # US5 depends on Foundational (parallel with US1, US2)
bd dep add $PN $P3  # Polish depends on US1 (MVP)
bd dep add $PN $P4  # Polish depends on US2
bd dep add $PN $P5  # Polish depends on US3
bd dep add $PN $P6  # Polish depends on US4
bd dep add $PN $P7  # Polish depends on US5

echo "Dependencies configured"

# Sync and show tree
bd sync
bd dep tree $EPIC

echo ""
echo "Update tasks.md with these IDs:"
echo "  Epic ID: $EPIC"
echo "  Phase 1 (Setup): $P1"
echo "  Phase 2 (Foundational): $P2"
echo "  Phase 3 (US1 MVP): $P3"
echo "  Phase 4 (US2): $P4"
echo "  Phase 5 (US3): $P5"
echo "  Phase 6 (US4): $P6"
echo "  Phase 7 (US5): $P7"
echo "  Phase 8 (Polish): $PN"
```

### Labels Reference

| Label | Purpose |
|-------|--------|
| `spec:003-content-authoring-versioning` | Links all issues to this feature |
| `phase:setup` | Setup phase tasks |
| `phase:foundational` | Foundational/blocking tasks |
| `phase:us1`, `phase:us2`, etc. | User story phases |
| `phase:polish` | Polish and cross-cutting |
| `parallel:true` | Task is parallelizable |
| `component:backend` | Backend component grouping |
| `component:frontend` | Frontend component grouping |

### Session Management

**Start of session:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:003-content-authoring-versioning' --status in_progress
bd ready --limit 5
```

**End of session (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```
