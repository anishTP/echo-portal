# Tasks: Left Sidebar Redesign — Three-Level Content Hierarchy

**Feature**: `specs/011-sidebar-content-hierarchy/`
**Input Documents**: plan.md, spec.md, research.md, data-model.md, contracts/subcategories-api.md
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-wq97` |
| **Spec Label** | `spec:011-sidebar-content-hierarchy` |
| **User Stories Source** | `specs/011-sidebar-content-hierarchy/spec.md` |
| **Planning Details** | `specs/011-sidebar-content-hierarchy/plan.md` |
| **Data Model** | `specs/011-sidebar-content-hierarchy/data-model.md` |

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Left Sidebar Redesign — Three-Level Content Hierarchy |
| **User Stories** | 5 from spec.md |
| **Priority** | P1 (US1 + US2 MVP) → P2 (US3, US4) → P3 (US5) |
| **Est. Tasks** | 34 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- **Testing as Contract (X)**: Backend integration + frontend component tests required
- **Explicit Change Control (I)**: All mutations audit-logged, draft-branch gated
- **Specification Completeness (VIII)**: 29 functional requirements, 14 clarifications resolved
- **Clarity Over Breadth (IX)**: @dnd-kit justified (only DnD library needed)

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

## Phase 1: Setup — ✅ COMPLETED

**Beads Phase ID**: `echo-portal-qnj5`
**Purpose**: Install new dependencies required for drag-and-drop
**Blocks**: Phase 4 (DnD implementation)
**Parallelism**: Single task

- [x] T001 Install @dnd-kit/core and @dnd-kit/sortable in frontend workspace `frontend/package.json`

**✓ Checkpoint**: `pnpm install` succeeds, @dnd-kit packages available for import

---

## Phase 2: Foundational — Database, Backend API & Shared Types — ✅ COMPLETED

**Beads Phase ID**: `echo-portal-uvrv`
**Purpose**: Create subcategories table, API endpoints, shared types, and frontend API client — everything user stories depend on
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

### Database Schema

- [x] T002 [P] Create subcategories Drizzle schema table with id (uuid PK), name, categoryId (FK → categories), displayOrder, createdBy (FK → users), timestamps. Add unique constraint on (categoryId, name) and index on categoryId `backend/src/db/schema/subcategories.ts`
- [x] T003 [P] Add subcategoryId (uuid, nullable FK → subcategories.id ON DELETE SET NULL) and categoryId (uuid, nullable FK → categories.id ON DELETE SET NULL) columns to contents table. Add indexes on both new columns `backend/src/db/schema/contents.ts`
- [x] T004 [P] Update ContentSummary and related types with subcategoryId (string | null) and categoryId (string | null) fields `shared/types/content.ts`
- [x] T005 Export subcategories schema from schema barrel file `backend/src/db/schema/index.ts`
- [x] T006 Write SQL migration 0011: create subcategories table, add columns to contents, run data migration that creates subcategory records from distinct contents.category values per section (assigned to first category by displayOrder), link content pieces to new subcategory records `backend/src/db/migrations/0011_add_subcategories.sql`

### Backend API

- [x] T007 Create subcategories API routes following categories.ts pattern — GET (list by categoryId, public), POST (create, contributor+, draft-only), PATCH :id (rename, contributor+, draft-only), DELETE :id (cascade-delete content in transaction, contributor+, draft-only), PUT /reorder (interleaved reorder, contributor+, draft-only). Include audit logging for all mutations `backend/src/api/routes/subcategories.ts`
- [x] T008 Mount subcategory routes as `/subcategories` in the API router `backend/src/api/index.ts`
- [x] T009 Update content routes: accept subcategoryId/categoryId in creation/update schemas, add PATCH /contents/:contentId/move endpoint for DnD reassignment (contributor+, draft-only) `backend/src/api/routes/contents.ts`

### Frontend Client

- [x] T010 [P] Create subcategory API client following category-api.ts pattern — list(categoryId), create(data), rename(id, data), delete(id, branchId), reorder(data), moveContent(contentId, data) `frontend/src/services/subcategory-api.ts`

**✓ Checkpoint**: Schema compiles, migration runs, all API endpoints respond correctly, frontend client exports all functions

---

## Phase 3: US1 & US2 — Three-Level Hierarchy + Simplified Chrome (P1) 🎯 MVP — ✅ COMPLETED

**Beads Phase ID**: `echo-portal-invi`
**Goal**: Users see a clean, minimal three-level tree (Category → Subcategory → Content Piece) with no old chrome elements. Selected content highlighted. Expand/collapse works. Auto-expand active content ancestors.
**Acceptance**: Load sidebar with sample data. Categories expand to show subcategories. Subcategories expand to show content. No search bar, branch banner, filter pills, type badges, or action buttons present. Selected content highlighted.
**Dependencies**: Phase 2 complete

- [x] T011 [US1][US2] Strip old sidebar elements: remove search bar (⌘K input), branch status banner, branch action buttons (Submit for Review, Review Changes, View Feedback), content type filter pills (All/Guidelines/Assets/Opinions), content type badges (G/A/O) from LibrarySidebar `frontend/src/components/library/LibrarySidebar.tsx`
- [x] T012 [US1] Build three-level collapsible tree structure — Category rows with folder icon + chevron, Subcategory rows indented with right-arrow chevron, Content pieces further indented as plain text. Interleaved display order for subcategories and loose content within a category `frontend/src/components/library/LibrarySidebar.tsx`
- [x] T013 [US1] Implement expand/collapse state with useState<Set<string>> — persist in-memory for session, auto-expand active content piece's parent subcategory and category on load `frontend/src/components/library/LibrarySidebar.tsx`
- [x] T014 [US1] Implement selected content piece visual highlighting — light gray background with slightly bolder font weight `frontend/src/components/library/LibrarySidebar.tsx`
- [x] T015 [US1] Update Library.tsx to fetch subcategories via subcategory-api.ts (using TanStack Query) and pass subcategory data to LibrarySidebar alongside categories and content `frontend/src/pages/Library.tsx`
- [x] T016 [P] [US1][US2] Write frontend component tests: three-level tree renders categories/subcategories/content at correct nesting, expand/collapse toggles work, selected content is highlighted, auto-expand on load, removed elements are absent (search, banner, filters, badges, action buttons) `frontend/tests/unit/sidebar-tree.test.tsx`
- [x] T017 [P] Write backend integration tests for GET /api/v1/subcategories endpoint — list by categoryId, empty result, invalid categoryId `backend/tests/integration/subcategories.test.ts`

**✓ Checkpoint**: Sidebar renders three-level hierarchy with no old chrome. Expand/collapse works. Active content auto-expanded. All P1 acceptance scenarios pass.

---

## Phase 4: US3 — Subcategory Management in Draft Branches (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-e5wy`
**Goal**: Contributors can create, rename, reorder, delete subcategories and reassign content via DnD — all gated to draft branch mode
**Acceptance**: In draft branch: right-click category shows Add Subcategory + Add Content, right-click subcategory shows Rename/Delete/Add Content. Inline editing works. DnD reorders subcategories and reassigns content. On published branch: no mutation actions visible.
**Dependencies**: Phase 2 complete, Phase 3 complete (tree structure needed for context menus and DnD)

### Context Menus & Inline Editing

- [ ] T018 [US3] Add Radix UI context menus: category right-click shows Add Subcategory + Add Content (contributor+), subcategory right-click shows Rename + Delete + Add Content (contributor+), content right-click preserves existing Rename + Delete `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T019 [US3] Implement inline text field for "Add Subcategory" — appears at top of category's children list, auto-expands category if collapsed, Enter saves via POST API, Escape/blur cancels, empty/duplicate name cancels silently `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T020 [US3] Implement inline text field for subcategory rename — pre-filled with current name, Enter saves via PATCH API, Escape/blur/invalid input (empty, duplicate) silently reverts to original `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T021 [US3] Implement delete subcategory confirmation dialog — shows count of content pieces that will be cascade-deleted, confirm triggers DELETE API call `frontend/src/components/library/LibrarySidebar.tsx`

### Drag-and-Drop

- [ ] T022 [US3] Implement DnD reordering for subcategories and loose content within a category using @dnd-kit/sortable — drag to reorder interleaved items, calls PUT /reorder API on drop `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T023 [US3] Implement DnD content reassignment between subcategories using @dnd-kit cross-container drag — drop content on different subcategory or parent category (to unassign), constrained to same section, calls PATCH /contents/:id/move API `frontend/src/components/library/LibrarySidebar.tsx`

### Draft Branch Gating

- [ ] T024 [US3] Gate all mutation context menu items and DnD interactions to draft branch mode only — hide Add Subcategory, Add Content, Rename, Delete from menus when not in draft branch, disable DnD `frontend/src/components/library/LibrarySidebar.tsx`

### Tests

- [ ] T025 [P] [US3] Write backend integration tests for mutation endpoints — POST /subcategories (auth, permissions, draft guard, duplicate name conflict), PATCH /subcategories/:id (rename, 404, conflict), DELETE /subcategories/:id (cascade count, 404), PUT /reorder (validate order items), PATCH /contents/:id/move (reassignment) `backend/tests/integration/subcategories.test.ts`
- [ ] T026 [P] [US3] Write frontend component tests for context menu visibility, inline create/rename, delete confirmation dialog, DnD reorder, DnD reassignment, draft-branch gating `frontend/tests/unit/sidebar-tree.test.tsx`

**✓ Checkpoint**: All subcategory CRUD operations work in draft mode. DnD reorders and reassigns content. No mutations possible on published branch. All US3 acceptance scenarios pass.

---

## Phase 5: US4 — Migration Verification (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-ldo7`
**Goal**: Verify that the SQL migration correctly creates subcategories from free-text category values and links content
**Acceptance**: Migration test confirms: subcategory records created from distinct category values, content pieces linked to correct subcategories, content without category assigned to first category in section, old category text retained
**Dependencies**: Phase 2 complete (migration SQL written in T006)

- [ ] T027 [US4] Write migration verification tests: confirm subcategories created from distinct contents.category values per section, content.subcategoryId populated correctly, content.categoryId populated (first category by displayOrder in section), content without category gets categoryId but no subcategoryId, old category text column retained unchanged `backend/tests/integration/migration.test.ts`

**✓ Checkpoint**: Migration tests pass against test data. All US4 acceptance scenarios verified.

---

## Phase 6: US5 — Admin Category Management (P3) — ⬜ Pending

**Beads Phase ID**: `echo-portal-o5lm`
**Goal**: Admin-only category management (create, rename, reorder, delete) works correctly in the new three-level tree
**Acceptance**: Admin right-click on category shows Rename/Delete/Reorder + Add Subcategory + Add Content. Non-admin contributor sees only Add Subcategory + Add Content. Published branch shows no mutation actions.
**Dependencies**: Phase 4 complete (context menus must exist)

- [ ] T028 [US5] Implement role-based context menu differentiation — admin sees Rename Category + Delete Category + Reorder in category context menu, contributor sees only Add Subcategory + Add Content `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T029 [US5] Ensure admin category actions (rename, delete, reorder) integrate with new tree structure and trigger correct API calls `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T030 [P] [US5] Write frontend tests for role-based context menu visibility — admin vs contributor vs viewer, draft vs published branch `frontend/tests/unit/sidebar-tree.test.tsx`

**✓ Checkpoint**: Admin category management preserved. Role differentiation verified. All US5 acceptance scenarios pass.

---

## Phase 7: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `echo-portal-qp52`
**Purpose**: Edge case coverage, accessibility, performance, and final validation
**Dependencies**: All user story phases complete

- [ ] T031 [P] Write edge case tests: empty categories, empty subcategories, concurrent subcategory creation (unique constraint), cascade delete of category with subcategories, 500+ content pieces performance `backend/tests/integration/subcategories.test.ts` `frontend/tests/unit/sidebar-tree.test.tsx`
- [ ] T032 [P] Accessibility review — keyboard navigation for tree expand/collapse, ARIA tree role attributes, focus management for inline editors `frontend/src/components/library/LibrarySidebar.tsx`
- [ ] T033 Run quickstart.md validation end-to-end — verify all setup steps, migration, and test commands work
- [ ] T034 Code cleanup — remove unused imports from old sidebar code, verify no regressions in existing test suite, bundle size review

**✓ Checkpoint**: Feature complete, all edge cases covered, accessible, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational (DB + API + Types)
    │
    ├───────────────────────────────────┐
    ▼                                   │
Phase 3: US1 & US2 (P1 MVP 🎯)         │
    │                                   │
    ├───────────────┐                   │
    ▼               ▼                   │
Phase 4: US3     Phase 5: US4           │
(P2)             (P2)                   │
    │               │                   │
    ▼               │                   │
Phase 6: US5        │                   │
(P3)               │                   │
    │               │                   │
    └───────────────┘                   │
            │                           │
            ▼                           │
    Phase 7: Polish ◄──────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1 & US2** → Combined P1 MVP phase, must complete before US3
4. **US3 (P2)** → Requires tree structure from Phase 3 for context menus and DnD
5. **US4 (P2)** → Can run parallel with US3 (migration tests only depend on Phase 2)
6. **US5 (P3)** → Requires context menus from Phase 4
7. **Polish** → After all user story phases complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 & US2 (MVP) → STOP & VALIDATE → [US3 → US4 → US5 → Polish]
```

Ship after Phase 3 if viable. Add management features incrementally.

### Strategy B: Sequential Priority

```
Setup → Foundational → US1 & US2 → US3 + US4 (parallel) → US5 → Polish
```

One priority tier at a time. US3 and US4 can be parallelized (different files/concerns).

---

## Parallel Execution Examples

### Within Foundational Phase

```bash
# Schema files in parallel (different files)
T002 & T003 & T004
wait

# Sequential (depends on schema)
T005  # export from index
T006  # migration SQL
T007  # API routes (depends on schema)
T008  # mount routes (depends on T007)

# Can run parallel with T007-T008
T009  # content route updates
T010  # frontend API client
```

### Within US1 & US2 Phase

```bash
# Sequential sidebar rewrite
T011 → T012 → T013 → T014

# Parallel with sidebar rewrite (different file)
T015  # Library.tsx

# Tests (parallel, after implementation)
T016 & T017
```

### US3 and US4 in Parallel

```bash
# Phase 4 (US3) and Phase 5 (US4) can overlap
(T018 → T019 → T020 → T021 → T022 → T023 → T024) & T027
# Tests in parallel
T025 & T026
```

---

## Beads ID Mapping

| Task ID | Beads ID | Status |
|---------|----------|--------|
| Epic | `echo-portal-wq97` | ⬜ |
| Phase 1 | `echo-portal-qnj5` | ⬜ |
| Phase 2 | `echo-portal-uvrv` | ⬜ |
| Phase 3 | `echo-portal-invi` | ⬜ |
| Phase 4 | `echo-portal-e5wy` | ⬜ |
| Phase 5 | `echo-portal-ldo7` | ⬜ |
| Phase 6 | `echo-portal-o5lm` | ⬜ |
| Phase 7 | `echo-portal-qp52` | ⬜ |
| T001 | `echo-portal-qnj5.1` | ⬜ |
| T002 | `echo-portal-uvrv.1` | ⬜ |
| T003 | `echo-portal-uvrv.2` | ⬜ |
| T004 | `echo-portal-uvrv.3` | ⬜ |
| T005 | `echo-portal-uvrv.4` | ⬜ |
| T006 | `echo-portal-uvrv.5` | ⬜ |
| T007 | `echo-portal-uvrv.6` | ⬜ |
| T008 | `echo-portal-uvrv.7` | ⬜ |
| T009 | `echo-portal-uvrv.8` | ⬜ |
| T010 | `echo-portal-uvrv.9` | ⬜ |
| T011 | `echo-portal-invi.1` | ⬜ |
| T012 | `echo-portal-invi.2` | ⬜ |
| T013 | `echo-portal-invi.3` | ⬜ |
| T014 | `echo-portal-invi.4` | ⬜ |
| T015 | `echo-portal-invi.5` | ⬜ |
| T016 | `echo-portal-invi.6` | ⬜ |
| T017 | `echo-portal-invi.7` | ⬜ |
| T018 | `echo-portal-e5wy.1` | ⬜ |
| T019 | `echo-portal-e5wy.2` | ⬜ |
| T020 | `echo-portal-e5wy.3` | ⬜ |
| T021 | `echo-portal-e5wy.4` | ⬜ |
| T022 | `echo-portal-e5wy.5` | ⬜ |
| T023 | `echo-portal-e5wy.6` | ⬜ |
| T024 | `echo-portal-e5wy.7` | ⬜ |
| T025 | `echo-portal-e5wy.8` | ⬜ |
| T026 | `echo-portal-e5wy.9` | ⬜ |
| T027 | `echo-portal-ldo7.1` | ⬜ |
| T028 | `echo-portal-o5lm.1` | ⬜ |
| T029 | `echo-portal-o5lm.2` | ⬜ |
| T030 | `echo-portal-o5lm.3` | ⬜ |
| T031 | `echo-portal-qp52.1` | ⬜ |
| T032 | `echo-portal-qp52.2` | ⬜ |
| T033 | `echo-portal-qp52.3` | ⬜ |
| T034 | `echo-portal-qp52.4` | ⬜ |

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- US1 and US2 are combined in Phase 3 since both are P1 and deeply coupled (same component rewrite)
- The SQL migration (T006) is foundational but migration *verification* (T027) is US4
- All DnD tasks (T022-T024) require @dnd-kit from T001
- LibrarySidebar.tsx tasks within a phase are sequential (same file)
- Backend test tasks and frontend test tasks within a phase can run in parallel
- Always run `bd sync` at end of session to persist tracking state
