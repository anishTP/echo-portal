# Implementation Plan: Left Sidebar Redesign — Three-Level Content Hierarchy

**Branch**: `011-sidebar-content-hierarchy` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-sidebar-content-hierarchy/spec.md`

## Summary

Redesign the left sidebar to display a three-level content hierarchy (Category → Subcategory → Content Piece), replacing the current two-level flat structure. This involves: (1) a new `subcategories` database table with migration of existing free-text category values, (2) CRUD API endpoints for subcategory management, (3) a major frontend rewrite of `LibrarySidebar.tsx` removing 5 UI elements and introducing a collapsible tree with drag-and-drop reordering via `@dnd-kit`, and (4) comprehensive backend + frontend tests.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 + Radix UI + Zustand + TanStack Query 5 (frontend), Drizzle ORM 0.44, @dnd-kit/core + @dnd-kit/sortable (new)
**Storage**: PostgreSQL (existing Drizzle schema — new `subcategories` table, modified `contents` table)
**Testing**: Vitest 3.1.3 (node for backend, jsdom for frontend), Playwright 1.52.0 (e2e)
**Target Platform**: Web application (pnpm monorepo: backend/, frontend/, shared/)
**Project Type**: Web application
**Performance Goals**: Sidebar renders full three-level hierarchy within 1 second for up to 500 content pieces (SC-002)
**Constraints**: All mutations draft-branch-only, subcategory parent immutable after creation, old `category` text column retained but deprecated
**Scale/Scope**: Up to 500 content pieces across multiple categories and subcategories per section

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All subcategory mutations require authenticated user action in draft branch. Cascade-delete requires explicit confirmation. Audit events logged for all operations.
- [x] **Single Source of Truth (II)**: Published content sidebar is read-only. All mutations blocked on non-draft branches. Subcategories are linked to categories via FK, not duplicated.
- [x] **Branch-First Collaboration (III)**: All sidebar mutations (create/rename/delete/reorder subcategories, drag-and-drop) gated to draft branch state. Context menus hidden on published/review/approved branches.
- [x] **Separation of Concerns (IV)**: GET /subcategories is public (read). All mutations require auth + contributor role. Context menus only visible in draft branch mode.
- [x] **Role-Driven Governance (V)**: Four roles defined — Viewer (browse), Contributor (manage subcategories + content), Reviewer (same as contributor for sidebar), Administrator (manage categories + subcategories). Permission matrix in spec.
- [x] **Open by Default (VI)**: Published subcategories visible to all users including anonymous. Subcategory listing is a public endpoint.
- [x] **Layered Architecture (VII)**: New `subcategories` routes follow existing Hono pattern. Core branch/review/publish workflows unchanged. Sidebar changes are UI-only (no core contract changes).
- [x] **Specification Completeness (VIII)**: Spec includes all mandatory sections: Actors/Permissions, Lifecycle States, Visibility Boundaries, Auditability, Success Criteria, Verification Requirements. 14 clarifications resolved across 3 sessions.
- [x] **Clarity Over Breadth (IX)**: No unnecessary complexity. @dnd-kit is the minimal library for the required drag-and-drop. Interleaved ordering uses displayOrder on existing entities (no new junction tables). See Complexity Tracking below.
- [x] **Testing as Contract (X)**: Backend integration tests for all 5 subcategory endpoints. Frontend component tests for tree rendering, DnD, context menus. Migration verification. 80% coverage target.

## Project Structure

### Documentation (this feature)

```text
specs/011-sidebar-content-hierarchy/
├── plan.md              # This file
├── spec.md              # Feature specification (14 clarifications resolved)
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity schemas and relationships
├── quickstart.md        # Phase 1: Setup and development guide
├── contracts/           # Phase 1: API contracts
│   └── subcategories-api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── subcategories.ts        # NEW — Subcategory Drizzle schema
│   │   │   ├── contents.ts             # MODIFY — Add subcategoryId, categoryId
│   │   │   └── index.ts                # MODIFY — Export subcategories
│   │   └── migrations/
│   │       └── 0011_add_subcategories.sql  # NEW — Table + data migration
│   └── api/
│       ├── routes/
│       │   ├── subcategories.ts        # NEW — CRUD endpoints
│       │   └── contents.ts             # MODIFY — Accept subcategoryId/categoryId
│       └── index.ts                    # MODIFY — Mount subcategory routes
└── tests/
    └── integration/
        └── subcategories.test.ts       # NEW — API integration tests

frontend/
├── src/
│   ├── components/
│   │   └── library/
│   │       └── LibrarySidebar.tsx       # REWRITE — Three-level tree
│   ├── pages/
│   │   └── Library.tsx                  # MODIFY — Pass subcategory data
│   └── services/
│       └── subcategory-api.ts           # NEW — API client
└── tests/
    └── unit/
        └── sidebar-tree.test.tsx        # NEW — Component tests

shared/
└── types/
    └── content.ts                       # MODIFY — Add subcategoryId, categoryId
```

**Structure Decision**: Existing pnpm monorepo structure (backend/, frontend/, shared/) is preserved. New files follow established patterns — schema files in `backend/src/db/schema/`, routes in `backend/src/api/routes/`, API clients in `frontend/src/services/`.

## Complexity Tracking

| Concern | Justification | Simpler Alternative Rejected Because |
|---------|---------------|-------------------------------------|
| @dnd-kit dependency | Required for drag-and-drop reordering + cross-container content reassignment | Custom drag implementation would be significantly more code, less accessible, and harder to maintain. Current sidebar has no DnD — "Move Up/Down" buttons are insufficient for interleaved ordering. |
| Interleaved display order | Subcategories and loose content share one ordering space per spec clarification | Separate ordering (subcategories first, then content) was rejected by the user. Interleaved model requires a unified reorder API but avoids a junction table. |
| Cascade-delete on subcategory removal | Spec requires cascade-delete with confirmation warning | Re-assign to "Uncategorized" was rejected. Block-until-empty adds extra user steps for a destructive action they've already confirmed. |

## Phase 0: Research Summary

All technology decisions documented in [research.md](./research.md). Key decisions:

1. **@dnd-kit** for drag-and-drop (modern, React 19 compatible, tree-shakable)
2. **Interleaved displayOrder** on entities directly (no junction table)
3. **Single SQL migration** with data backfill in transaction
4. **React useState** for expand/collapse state (in-memory only)
5. **AuditLogger** for subcategory event logging (existing pattern)

## Phase 1: Design Summary

### Data Model

Full schema in [data-model.md](./data-model.md). Key additions:
- **NEW TABLE**: `subcategories` (id, name, categoryId FK, displayOrder, createdBy, timestamps)
- **MODIFIED TABLE**: `contents` + `subcategory_id` (nullable FK) + `category_id` (nullable FK)
- **DEPRECATED**: `contents.category` text column retained for rollback, no longer written to

### API Contracts

Full contracts in [contracts/subcategories-api.md](./contracts/subcategories-api.md). Endpoints:
- `GET /api/v1/subcategories?categoryId=<uuid>` — List (public)
- `POST /api/v1/subcategories` — Create (contributor+, draft only)
- `PATCH /api/v1/subcategories/:id` — Rename (contributor+, draft only)
- `DELETE /api/v1/subcategories/:id` — Cascade-delete (contributor+, draft only)
- `PUT /api/v1/subcategories/reorder` — Reorder interleaved items (contributor+, draft only)
- `PATCH /api/v1/contents/:id/move` — Move content between subcategories (contributor+, draft only)

### Implementation Phases

#### Phase 1: Database & Schema
- Create `backend/src/db/schema/subcategories.ts` following `categories.ts` pattern
- Add `subcategoryId` + `categoryId` columns to `contents.ts`
- Export from `backend/src/db/schema/index.ts`
- Write `0011_add_subcategories.sql` migration with data backfill

#### Phase 2: Backend API
- Create `backend/src/api/routes/subcategories.ts` (5 endpoints)
- Mount in `backend/src/api/index.ts` as `api.route('/subcategories', subcategoryRoutes)`
- Update content create/update schemas in `contents.ts` routes
- Add `PATCH /contents/:id/move` for drag-and-drop reassignment
- Audit log all subcategory CRUD operations
- Create `frontend/src/services/subcategory-api.ts`
- Update `shared/types/content.ts` (ContentSummary adds subcategoryId, categoryId)

#### Phase 3: Frontend Sidebar
- `pnpm add @dnd-kit/core @dnd-kit/sortable` in frontend
- Rewrite `LibrarySidebar.tsx`:
  - Remove: search bar, branch banner, action buttons, filter pills, type badges
  - Build: three-level collapsible tree with folder/chevron iconography
  - Implement: interleaved ordering of subcategories + loose content
  - Add: DnD sortable for reordering + cross-container for content reassignment
  - Add: context menus (category → admin actions + Add Subcategory + Add Content; subcategory → Rename/Delete/Add Content; content → Rename/Delete)
  - Add: inline editing for subcategory create (top of list) and rename (pre-filled)
  - Add: expand/collapse state with `useState<Set<string>>`
  - Add: auto-expand active content's ancestors on load
  - Add: delete confirmation dialog with cascade count
- Update `Library.tsx` to fetch subcategories and pass to sidebar
- Update `NavSection.tsx` or replace with tree node components

#### Phase 4: Testing
- Backend: `subcategories.test.ts` — Integration tests for all 5 endpoints (auth, permissions, draft guard, conflicts, cascade delete)
- Frontend: `sidebar-tree.test.tsx` — Component tests for tree rendering, expand/collapse, context menu visibility, DnD
- Migration: Verify data backfill correctness

### Quickstart

Development setup guide in [quickstart.md](./quickstart.md).

## Constitution Re-Check (Post-Design)

- [x] **I. Explicit Change Control**: All subcategory mutations are user-initiated, require draft branch, logged in audit. Cascade-delete requires confirmation.
- [x] **II. Single Source of Truth**: Published sidebar is read-only. Subcategories linked via FK to categories (not duplicated).
- [x] **III. Branch-First**: All mutations gated to draft state. API validates branch state before executing.
- [x] **IV. Separation of Concerns**: GET endpoints are public (read). All mutations require auth + role (write). Context menus hidden in consumption mode.
- [x] **V. Role-Driven Governance**: Viewer=browse, Contributor=manage subcategories/content, Admin=manage categories. All logged.
- [x] **VI. Open by Default**: Subcategory listing is public. Published hierarchy visible to anonymous users.
- [x] **VII. Layered Architecture**: New routes follow existing Hono pattern. No changes to branch/review/publish core contracts.
- [x] **VIII. Specification Completeness**: All mandatory sections present. 14 clarifications resolved. 29 functional requirements defined.
- [x] **IX. Clarity Over Breadth**: @dnd-kit justified (no simpler alternative for interleaved DnD). No unnecessary abstractions.
- [x] **X. Testing as Contract**: Integration tests for all API endpoints. Component tests for sidebar tree. 80% coverage target.
