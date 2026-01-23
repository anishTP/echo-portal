# Tasks: Branch Isolation Model

**Feature**: `specs/001-branch-isolation-model/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-6hu` |
| **Spec Label** | `spec:branch-isolation-model` |
| **User Stories Source** | `specs/001-branch-isolation-model/spec.md` |
| **Planning Details** | `specs/001-branch-isolation-model/plan.md` |
| **Data Model** | `specs/001-branch-isolation-model/data-model.md` |

> **NOTE**: Run the Beads Issue Creation Script (at end of file) after generating this tasks.md to create the epic and phase issues in beads.

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Branch Isolation Model |
| **User Stories** | 6 from spec.md |
| **Priority** | P1 (US1-3 MVP) → P2 (US4-5) → P3 (US6) |
| **Est. Tasks** | 146 |

### User Story Summary

| Story | Title | Priority | Independent Test |
|-------|-------|----------|------------------|
| US1 | Create and Work in Isolated Branch | P1 (MVP) | Create branch, make changes, verify published unchanged |
| US2 | Submit Branch for Review | P1 (MVP) | Submit for review, reviewers can see changes |
| US3 | Publish Approved Branch | P1 (MVP) | Converge to main, verify immutable |
| US4 | Compare Branch to Published State | P2 | View diff, verify accuracy |
| US5 | Manage Branch Visibility | P2 | Set visibility, verify access control |
| US6 | Trace Branch Lineage and History | P3 | View audit trail, verify completeness |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.0:
- ✅ **Testing as Contract (X)**: Tests written before implementation (TDD)
- ✅ **Explicit Change Control (I)**: All changes attributable and intentional
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Complexity justified in plan.md

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

## Phase 1: Setup — ✅ COMPLETED (2026-01-21)

**Beads Phase ID**: `echo-portal-6hu.1`
**Purpose**: Project initialization, dependencies, tooling
**Blocks**: All subsequent phases
**Parallelism**: Most tasks can run in parallel

### Project Structure

- [x] T001 [P] Create monorepo structure with backend, frontend, shared directories per `plan.md`
- [x] T002 [P] Initialize backend package with TypeScript in `backend/package.json`
- [x] T003 [P] Initialize frontend package with Vite/React in `frontend/package.json`
- [x] T004 [P] Initialize shared types package in `shared/package.json`
- [x] T005 [P] Configure root workspace in `package.json` with pnpm workspaces

### Backend Setup

- [x] T006 [P] Configure TypeScript for backend in `backend/tsconfig.json`
- [x] T007 [P] Install backend dependencies: Hono, Drizzle ORM, isomorphic-git, XState v5 in `backend/package.json`
- [x] T008 [P] Setup Vitest for backend testing in `backend/vitest.config.ts`
- [x] T009 [P] Create environment configuration in `backend/.env.example`

### Frontend Setup

- [x] T010 [P] Configure Vite for React 19 in `frontend/vite.config.ts`
- [x] T011 [P] Install frontend dependencies: TanStack Query, Zustand, Monaco Editor in `frontend/package.json`
- [x] T012 [P] Setup Vitest for frontend testing in `frontend/vitest.config.ts`
- [x] T013 [P] Configure Playwright for E2E in `frontend/playwright.config.ts`

### Shared Setup

- [x] T014 [P] Configure TypeScript for shared types in `shared/tsconfig.json`
- [x] T015 [P] Create shared constants in `shared/constants/states.ts`

### Tooling

- [x] T016 [P] Configure ESLint for monorepo in `eslint.config.js`
- [x] T017 [P] Configure Prettier in `.prettierrc`
- [x] T018 [P] Setup Docker Compose for PostgreSQL in `docker-compose.yml`

**✓ Checkpoint**: `pnpm install` works, `pnpm dev` starts both frontend and backend, `pnpm test` executes

---

## Phase 2: Foundational — ✅ COMPLETED (2026-01-21)

**Beads Phase ID**: `echo-portal-6hu.2`
**Purpose**: Core infrastructure ALL user stories depend on
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

### Database & Schema

- [x] T019 Setup Drizzle configuration in `backend/src/db/index.ts`
- [x] T020 [P] Create database schema enums in `backend/src/db/schema/enums.ts`
- [x] T021 [P] Create User table schema in `backend/src/db/schema/users.ts`
- [x] T022 [P] Create Branch table schema in `backend/src/db/schema/branches.ts`
- [x] T023 [P] Create BranchStateTransition table schema in `backend/src/db/schema/branch-transitions.ts`
- [x] T024 [P] Create Review table schema in `backend/src/db/schema/reviews.ts`
- [x] T025 [P] Create Convergence table schema in `backend/src/db/schema/convergence.ts`
- [x] T026 [P] Create AuditLog table schema in `backend/src/db/schema/audit-logs.ts`
- [x] T027 Create schema index and migrations in `backend/src/db/schema/index.ts`
- [ ] T028 Generate initial migration in `backend/drizzle/0001_initial_schema.sql`

### Shared Types

- [x] T029 [P] Create User types in `shared/types/user.ts`
- [x] T030 [P] Create Branch types in `shared/types/branch.ts`
- [x] T031 [P] Create Review types in `shared/types/review.ts`
- [x] T032 [P] Create Convergence types in `shared/types/convergence.ts`
- [x] T033 [P] Create Workflow types in `shared/types/workflow.ts`
- [x] T034 Create types index in `shared/types/index.ts`

### Authentication

- [x] T035 Setup arctic OAuth library configuration for Hono in `backend/src/services/auth/config.ts`
- [x] T036 [P] Implement GitHub OAuth provider in `backend/src/services/auth/providers/github.ts`
- [x] T037 [P] Implement Google OAuth provider in `backend/src/services/auth/providers/google.ts`
- [x] T038 Implement permissions service in `backend/src/services/auth/permissions.ts`
- [x] T039 Create auth middleware for Hono in `backend/src/api/middleware/auth.ts`
- [x] T040 Create permissions middleware in `backend/src/api/middleware/permissions.ts`

### Audit Logging

- [x] T041 Implement audit logger service in `backend/src/services/audit/logger.ts`
- [x] T042 Create audit middleware in `backend/src/api/middleware/audit.ts`

### API Foundation

- [x] T043 Setup Hono app with OpenAPI in `backend/src/api/index.ts`
- [x] T044 [P] Create error handling utilities in `backend/src/api/utils/errors.ts`
- [x] T045 [P] Create response helpers in `backend/src/api/utils/responses.ts`
- [x] T046 [P] Create validation schemas with Zod in `backend/src/api/schemas/common.ts`

### Frontend Foundation

- [x] T047 Setup React Router in `frontend/src/router/index.tsx`
- [x] T048 [P] Create API client with TanStack Query in `frontend/src/services/api.ts`
- [x] T049 [P] Setup auth context in `frontend/src/context/AuthContext.tsx`
- [x] T050 [P] Create Zustand stores foundation in `frontend/src/stores/index.ts`
- [x] T051 [P] Create error boundary in `frontend/src/components/common/ErrorBoundary.tsx`

### Branch Integrity (FR-020)

- [x] T052 Implement orphan detection service to prevent dangling branches in `backend/src/services/branch/orphan-detection.ts`
- [x] T053 [P] Add lineage validation utility to verify branch traces to known published state in `backend/src/services/branch/lineage-validation.ts`

**✓ Checkpoint**: Foundation ready — database connected, auth working, API skeleton running, orphan prevention in place

---

## Phase 3: User Story 1 — Create and Work in Isolated Branch (P1) 🎯 MVP — ✅ COMPLETED (2026-01-22)

**Beads Phase ID**: `echo-portal-6hu.3`
**Goal**: Contributors can create branches, make edits, save work without affecting published content
**Acceptance**: Create branch, make changes, verify published content unchanged, verify owner can see edits
**Dependencies**: Phase 2 complete

### Backend - Git Service

- [x] T054 [P] [US1] Implement Git repository service in `backend/src/services/git/repository.ts`
- [x] T055 [P] [US1] Implement Git branch operations in `backend/src/services/git/branch.ts`
- [x] T056 [US1] Integrate isomorphic-git for branch creation in `backend/src/services/git/operations.ts`

### Backend - Branch Model & Service

- [x] T057 [P] [US1] Create Branch model with validation in `backend/src/models/branch.ts`
- [x] T058 [US1] Implement branch service (create, read, update) in `backend/src/services/branch/branch-service.ts`
- [x] T059 [US1] Add visibility enforcement in `backend/src/services/branch/visibility.ts`

### Backend - API Routes

- [x] T060 [US1] Create branch validation schemas in `backend/src/api/schemas/branches.ts`
- [x] T061 [US1] Implement POST /api/v1/branches route in `backend/src/api/routes/branches.ts`
- [x] T062 [US1] Implement GET /api/v1/branches route in `backend/src/api/routes/branches.ts`
- [x] T063 [US1] Implement GET /api/v1/branches/:id route in `backend/src/api/routes/branches.ts`
- [x] T064 [US1] Implement PATCH /api/v1/branches/:id route in `backend/src/api/routes/branches.ts`
- [x] T065 [US1] Register branch routes in API in `backend/src/api/index.ts`

### Frontend - Components

- [x] T066 [P] [US1] Create BranchCreate component in `frontend/src/components/branch/BranchCreate.tsx`
- [x] T067 [P] [US1] Create BranchList component in `frontend/src/components/branch/BranchList.tsx`
- [x] T068 [P] [US1] Create BranchDetail component in `frontend/src/components/branch/BranchDetail.tsx`
- [x] T069 [P] [US1] Create LifecycleStatus badge in `frontend/src/components/branch/LifecycleStatus.tsx`
- [x] T070 [P] [US1] Create EnvironmentIndicator in `frontend/src/components/common/EnvironmentIndicator.tsx`

### Frontend - Hooks & Services

- [x] T071 [US1] Create useBranch hook in `frontend/src/hooks/useBranch.ts`
- [x] T072 [US1] Create branch API service in `frontend/src/services/branchService.ts`
- [x] T073 [US1] Create branch store in `frontend/src/stores/branchStore.ts`

### Frontend - Pages

- [x] T074 [US1] Create Dashboard page in `frontend/src/pages/Dashboard.tsx`
- [x] T075 [US1] Create BranchWorkspace page in `frontend/src/pages/BranchWorkspace.tsx`
- [x] T076 [US1] Wire routes for branch management in `frontend/src/router/index.tsx`

**✓ Checkpoint**: User Story 1 functional — can create branch, edit, save, verify isolation

---

## Phase 4: User Story 2 — Submit Branch for Review (P1) 🎯 MVP — ✅ COMPLETED (2026-01-22)

**Beads Phase ID**: `echo-portal-6hu.4`
**Goal**: Contributors can submit branches for review, reviewers can approve or request changes
**Acceptance**: Submit for review, reviewers see changes, approve/reject works
**Dependencies**: Phase 2 complete, Phase 3 (US1) for branch creation

### Backend - State Machine

- [x] T077 [US2] Implement XState branch state machine in `backend/src/services/workflow/state-machine.ts`
- [x] T078 [US2] Create transition validators in `backend/src/services/workflow/transitions.ts`
- [x] T079 [US2] Implement validation guards in `backend/src/services/workflow/validation.ts`

### Backend - Review Service

- [x] T080 [P] [US2] Create Review model in `backend/src/models/review.ts`
- [x] T081 [US2] Implement review service in `backend/src/services/review/review-service.ts`
- [x] T082 [US2] Add review comment support in `backend/src/services/review/comments.ts`

### Backend - API Routes

- [x] T083 [US2] Create review validation schemas in `backend/src/api/schemas/reviews.ts`
- [x] T084 [US2] Implement POST /api/v1/branches/:id/transitions route in `backend/src/api/routes/branches.ts`
- [x] T085 [US2] Implement POST /api/v1/reviews route in `backend/src/api/routes/reviews.ts`
- [x] T086 [US2] Implement GET /api/v1/reviews route in `backend/src/api/routes/reviews.ts`
- [x] T087 [US2] Implement POST /api/v1/reviews/:id/approve route in `backend/src/api/routes/reviews.ts`
- [x] T088 [US2] Implement POST /api/v1/reviews/:id/request-changes route in `backend/src/api/routes/reviews.ts`
- [x] T089 [US2] Register review routes in API in `backend/src/api/index.ts`

### Frontend - Components

- [x] T090 [P] [US2] Create ReviewPanel component in `frontend/src/components/review/ReviewPanel.tsx`
- [x] T091 [P] [US2] Create ApprovalActions component in `frontend/src/components/review/ApprovalActions.tsx`
- [x] T092 [P] [US2] Create ReviewComments component in `frontend/src/components/review/ReviewComments.tsx`

### Frontend - Hooks & Services

- [x] T093 [US2] Create useWorkflow hook in `frontend/src/hooks/useWorkflow.ts`
- [x] T094 [US2] Create review API service in `frontend/src/services/reviewService.ts`
- [x] T095 [US2] Create workflow store in `frontend/src/stores/workflowStore.ts`

### Frontend - Pages

- [x] T096 [US2] Create ReviewQueue page in `frontend/src/pages/ReviewQueue.tsx`
- [x] T097 [US2] Wire routes for review management in `frontend/src/router/index.tsx`

**✓ Checkpoint**: User Story 2 functional — can submit for review, approve/reject

---

## Phase 5: User Story 3 — Publish Approved Branch (P1) 🎯 MVP — ✅ COMPLETED (2026-01-22)

**Beads Phase ID**: `echo-portal-6hu.5`
**Goal**: Publishers can merge approved branches to main with atomic convergence
**Acceptance**: Converge to main, verify changes visible, verify immutability, verify rollback on failure
**Dependencies**: Phase 2 complete, Phase 4 (US2) for approval

### Backend - Convergence Service

- [x] T098 [P] [US3] Create Convergence model in `backend/src/models/convergence.ts`
- [x] T099 [US3] Implement convergence service in `backend/src/services/convergence/convergence-service.ts`
- [x] T100 [US3] Implement conflict detection in `backend/src/services/convergence/conflict-detection.ts`
- [x] T101 [US3] Implement atomic merge with rollback in `backend/src/services/convergence/merge.ts`
- [x] T102 [US3] Implement first-wins blocking in `backend/src/services/convergence/locking.ts`

### Backend - API Routes

- [x] T103 [US3] Create convergence validation schemas in `backend/src/api/schemas/convergence.ts`
- [x] T104 [US3] Implement POST /api/v1/convergence route in `backend/src/api/routes/convergence.ts`
- [x] T105 [US3] Implement GET /api/v1/convergence/:id/status route in `backend/src/api/routes/convergence.ts`
- [x] T106 [US3] Implement POST /api/v1/convergence/validate route in `backend/src/api/routes/convergence.ts`
- [x] T107 [US3] Register convergence routes in API in `backend/src/api/index.ts`

### Frontend - Components

- [x] T108 [P] [US3] Create PublishButton component in `frontend/src/components/convergence/PublishButton.tsx`
- [x] T109 [P] [US3] Create ConvergenceStatus component in `frontend/src/components/convergence/ConvergenceStatus.tsx`
- [x] T110 [P] [US3] Create ConflictDisplay component in `frontend/src/components/convergence/ConflictDisplay.tsx`

### Frontend - Pages & Integration

- [x] T111 [US3] Create PublishConfirm page in `frontend/src/pages/PublishConfirm.tsx`
- [x] T112 [US3] Create useConvergence hook in `frontend/src/hooks/useConvergence.ts`
- [x] T113 [US3] Wire routes for publish flow in `frontend/src/router/index.tsx`

**✓ Checkpoint**: User Story 3 functional — can publish, verify atomicity

---

## Phase 6: User Story 4 — Compare Branch to Published State (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-6hu.6`
**Goal**: Users can see all changes between branch and published state
**Acceptance**: View diff, verify all additions/deletions/modifications shown accurately
**Dependencies**: Phase 2 complete

### Backend - Diff Service

- [ ] T114 [US4] Implement diff service using diff-match-patch in `backend/src/services/git/diff.ts`
- [ ] T115 [US4] Create diff formatting utilities in `backend/src/services/git/diff-format.ts`

### Backend - API Routes

- [ ] T116 [US4] Implement GET /api/v1/branches/:id/diff route in `backend/src/api/routes/branches.ts`
- [ ] T117 [US4] Implement GET /api/v1/branches/:id/diff/:targetBranchId route in `backend/src/api/routes/branches.ts`

### Frontend - Components

- [ ] T118 [P] [US4] Create DiffViewer component with Monaco in `frontend/src/components/review/DiffViewer.tsx`
- [ ] T119 [P] [US4] Create FileDiffList component in `frontend/src/components/review/FileDiffList.tsx`
- [ ] T120 [US4] Create useDiff hook in `frontend/src/hooks/useDiff.ts`

**✓ Checkpoint**: User Story 4 functional — can view accurate diffs

---

## Phase 7: User Story 5 — Manage Branch Visibility (P2) — ✅ COMPLETED (2026-01-23)

**Beads Phase ID**: `echo-portal-6hu.7`
**Goal**: Branch owners can control who sees their work
**Acceptance**: Set visibility levels, verify access control works for different user types
**Dependencies**: Phase 2 complete

### Backend - Visibility Service

- [x] T121 [US5] Enhance visibility enforcement in `backend/src/services/branch/visibility.ts` — ✅ (2026-01-23)
- [x] T122 [US5] Add team member management in `backend/src/services/branch/team.ts` — ✅ (2026-01-23)

### Frontend - Components

- [x] T123 [P] [US5] Create VisibilitySelector component in `frontend/src/components/branch/VisibilitySelector.tsx` — ✅ (2026-01-23)
- [x] T124 [P] [US5] Create TeamMemberPicker component in `frontend/src/components/branch/TeamMemberPicker.tsx` — ✅ (2026-01-23)
- [x] T125 [US5] Integrate visibility into BranchDetail in `frontend/src/components/branch/BranchDetail.tsx` — ✅ (2026-01-23)

**✓ Checkpoint**: User Story 5 functional — visibility controls work

---

## Phase 8: User Story 6 — Trace Branch Lineage and History (P3) — ✅ COMPLETED (2026-01-23)

**Beads Phase ID**: `echo-portal-6hu.8`
**Goal**: Users can view complete audit trail and lineage
**Acceptance**: View all events with timestamps, actors, and reasons
**Dependencies**: Phase 2 complete

### Backend - Audit Service Enhancement

- [x] T126 [US6] Implement audit query service in `backend/src/services/audit/query.ts` — ✅ (2026-01-23)
- [x] T127 [US6] Add lineage tracing in `backend/src/services/audit/lineage.ts` — ✅ (2026-01-23)

### Backend - API Routes

- [x] T128 [US6] Create audit validation schemas in `backend/src/api/schemas/audit.ts` — ✅ (2026-01-23)
- [x] T129 [US6] Implement GET /api/v1/audit route in `backend/src/api/routes/audit.ts` — ✅ (2026-01-23)
- [x] T130 [US6] Implement GET /api/v1/branches/:id/history route in `backend/src/api/routes/audit.ts` — ✅ (2026-01-23)
- [x] T131 [US6] Register audit routes in API in `backend/src/api/index.ts` — ✅ (2026-01-23)

### Frontend - Components

- [x] T132 [P] [US6] Create AuditTrail component in `frontend/src/components/common/AuditTrail.tsx` — ✅ (2026-01-23)
- [x] T133 [P] [US6] Create LineageViewer component in `frontend/src/components/common/LineageViewer.tsx` — ✅ (2026-01-23)
- [x] T134 [US6] Create useAudit hook in `frontend/src/hooks/useAudit.ts` — ✅ (2026-01-23)

**✓ Checkpoint**: User Story 6 functional — complete audit trail visible

---

## Phase 9: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `echo-portal-6hu.9`
**Purpose**: Quality improvements affecting multiple stories
**Dependencies**: All desired user stories complete

### Documentation

- [ ] T135 [P] Update API documentation in `docs/api.md`
- [ ] T136 [P] Create user guide in `docs/user-guide.md`
- [ ] T137 [P] Update README with setup instructions in `README.md`

### Performance & Optimization

- [ ] T138 [P] Add React.memo to list components in `frontend/src/components/`
- [ ] T139 [P] Implement lazy loading for routes in `frontend/src/router/index.tsx`
- [ ] T140 [P] Add database query optimization indexes in `backend/drizzle/`

### Edge Cases & Hardening

- [ ] T141 [P] Add forbidden transition tests in `backend/tests/integration/transitions.test.ts`
- [ ] T142 [P] Add concurrent convergence tests in `backend/tests/integration/convergence.test.ts`
- [ ] T143 [P] Add permission loss handling in `backend/src/api/middleware/permissions.ts`

### Validation

- [ ] T144 Run quickstart.md validation end-to-end
- [ ] T145 Performance testing for success criteria (5s branch create, 3s diff, 10s convergence)
- [ ] T146 Security audit for role-based access control

**✓ Checkpoint**: Feature complete, documented, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ─────────────────────────────────────────────┐
    │                                                               │
    ├───────────────┬───────────────┬───────────┬────────┬────────┤
    ▼               ▼               ▼           ▼        ▼        │
Phase 3: US1    Phase 6: US4    Phase 7: US5  Phase 8: US6       │
(P1 MVP 🎯)      (P2)            (P2)         (P3)               │ (parallel)
    │                                                             │
    ▼                                                             │
Phase 4: US2 (P1 MVP 🎯) ──────────────────────────────────────────
    │
    ▼
Phase 5: US3 (P1 MVP 🎯)
    │
    └───────────────┬───────────────┬───────────┬────────┬────────┐
                    │               │           │        │        │
                    ▼               ▼           ▼        ▼        ▼
                Phase 9: Polish ◄──────────────────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1** → Blocks US2 (need branches to submit)
4. **US2** → Blocks US3 (need approval to publish)
5. **US4, US5, US6** → Can run parallel after Foundational
6. **Within each story**: Models → Services → Routes → Components → Pages
7. **Polish** → After all desired stories complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 → US2 → US3 → STOP & VALIDATE → [US4 → US5 → US6 → Polish]
```

Ship after US3 (core workflow complete). Add P2/P3 stories incrementally.

### Strategy B: Parallel Team

```
All: Setup → Foundational
Then split:
  Dev A: US1 → US2 → US3 (critical path)
  Dev B: US4 (diff viewer)
  Dev C: US5 (visibility) + US6 (audit)
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → Polish
```

One story at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004 & T005 & T006 & T007 & T008 & T009 & T010 & T011 & T012 & T013 & T014 & T015 & T016 & T017 & T018
wait
```

### Within User Story 1

```bash
# Git service (parallel)
T054 & T055
wait

# Branch model/service (sequential)
T056
T057
T058
T059

# API routes (sequential - depend on service)
T060
T061
T062
T063
T064
T065

# Frontend components (parallel)
T066 & T067 & T068 & T069 & T070
wait

# Frontend integration (sequential)
T071
T072
T073
T074
T075
T076
```

### Across User Stories

```bash
# After Foundational complete
(Phase 3: US1) then (Phase 4: US2) then (Phase 5: US3)  # Sequential MVP
# While P2/P3 can run parallel:
(Phase 6: US4) & (Phase 7: US5) & (Phase 8: US6)
wait
# Then Polish
```

---

## Completion Tracking

### Task Completion (Markdown + Beads)

```markdown
- [x] T001 [P] Description `path/file.ext` — ✅ (2026-01-22)
```

```bash
# Update beads when completing a task
bd update {task-id} --status in_progress  # Before starting
bd close {task-id} --reason "Implemented {file}"  # After completion
bd sync  # Sync changes
```

### Phase Completion

```markdown
## Phase 1: Setup — ✅ COMPLETED (2026-01-22)

**Beads Phase ID**: `{phase-1-id}` — ✅ CLOSED
**Completed Tasks**: T001-T018 (Setup), T019-T053 (Foundational)
```

```bash
# Close phase in beads
bd close {phase-1-id} --reason "All setup tasks complete"
bd sync
```

### Story Completion

```markdown
## Phase 3: User Story 1 — Create and Work in Isolated Branch (P1) 🎯 MVP — ✅ COMPLETED (2026-01-23)

**Beads Phase ID**: `{phase-3-id}` — ✅ CLOSED
**Acceptance Verified**: ✅ Branch creation works, edits isolated, published unchanged
**Completed Tasks**: T054-T076
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **MVP Scope**: US1 + US2 + US3 provides complete workflow (create → review → publish)
- **Post-MVP Scope** (explicitly deferred):
  - Preview URLs per branch (e.g., `preview-<branch-id>.echo-portal.dev`)
  - Visual regression testing integration
  - Reviewer notifications (email, in-app)
  - Review deadline tracking
- **Avoid**: Vague tasks, same-file conflicts, cross-story dependencies that break independence
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state

---

## Beads Issue Creation Script

Run this script after generating tasks.md to create the epic and phase structure in beads:

```bash
#!/bin/bash
FEATURE="branch-isolation-model"
FEATURE_TITLE="Branch Isolation Model"
LABEL="spec:${FEATURE}"

# Create epic
EPIC=$(bd create "$FEATURE_TITLE" -t epic -p 1 -l "$LABEL" --json | jq -r '.id')
echo "Created Epic: $EPIC"

# Create phases
P1=$(bd create "Phase 1: Setup" -t feature -p 1 -l "$LABEL,phase:setup" --parent $EPIC --json | jq -r '.id')
P2=$(bd create "Phase 2: Foundational" -t feature -p 1 -l "$LABEL,phase:foundational" --parent $EPIC --json | jq -r '.id')
P3=$(bd create "Phase 3: US1 - Create Branch (MVP)" -t feature -p 1 -l "$LABEL,phase:us1" --parent $EPIC --json | jq -r '.id')
P4=$(bd create "Phase 4: US2 - Submit for Review (MVP)" -t feature -p 1 -l "$LABEL,phase:us2" --parent $EPIC --json | jq -r '.id')
P5=$(bd create "Phase 5: US3 - Publish Branch (MVP)" -t feature -p 1 -l "$LABEL,phase:us3" --parent $EPIC --json | jq -r '.id')
P6=$(bd create "Phase 6: US4 - Compare Branches" -t feature -p 2 -l "$LABEL,phase:us4" --parent $EPIC --json | jq -r '.id')
P7=$(bd create "Phase 7: US5 - Visibility Control" -t feature -p 2 -l "$LABEL,phase:us5" --parent $EPIC --json | jq -r '.id')
P8=$(bd create "Phase 8: US6 - Audit Trail" -t feature -p 3 -l "$LABEL,phase:us6" --parent $EPIC --json | jq -r '.id')
P9=$(bd create "Phase 9: Polish" -t feature -p 3 -l "$LABEL,phase:polish" --parent $EPIC --json | jq -r '.id')

echo "Created Phases: P1=$P1, P2=$P2, P3=$P3, P4=$P4, P5=$P5, P6=$P6, P7=$P7, P8=$P8, P9=$P9"

# Set phase dependencies
bd dep add $P2 $P1  # Foundational depends on Setup
bd dep add $P3 $P2  # US1 depends on Foundational
bd dep add $P4 $P3  # US2 depends on US1
bd dep add $P5 $P4  # US3 depends on US2
bd dep add $P6 $P2  # US4 depends on Foundational (parallel)
bd dep add $P7 $P2  # US5 depends on Foundational (parallel)
bd dep add $P8 $P2  # US6 depends on Foundational (parallel)
bd dep add $P9 $P5  # Polish depends on US3 (MVP complete)
bd dep add $P9 $P6  # Polish depends on US4
bd dep add $P9 $P7  # Polish depends on US5
bd dep add $P9 $P8  # Polish depends on US6

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
echo "  Phase 4 (US2 MVP): $P4"
echo "  Phase 5 (US3 MVP): $P5"
echo "  Phase 6 (US4): $P6"
echo "  Phase 7 (US5): $P7"
echo "  Phase 8 (US6): $P8"
echo "  Phase 9 (Polish): $P9"
```

### Labels Reference

| Label | Purpose |
|-------|--------|
| `spec:branch-isolation-model` | Links all issues to this feature |
| `phase:setup` | Setup phase tasks |
| `phase:foundational` | Foundational/blocking tasks |
| `phase:us1` through `phase:us6` | User story phases |
| `phase:polish` | Polish and cross-cutting |
| `parallel:true` | Task is parallelizable |

### Session Management

**Start of session:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:branch-isolation-model' --status in_progress
bd ready --limit 5
```

**End of session (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```
