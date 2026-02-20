# Tasks: Hierarchy Landing Pages

**Feature**: `specs/012-hierarchy-landing-pages/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-yw5u` |
| **Spec Label** | `spec:012-hierarchy-landing-pages` |
| **User Stories Source** | `specs/012-hierarchy-landing-pages/spec.md` |
| **Planning Details** | `specs/012-hierarchy-landing-pages/plan.md` |
| **Data Model** | `specs/012-hierarchy-landing-pages/data-model.md` |

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Hierarchy Landing Pages |
| **User Stories** | 7 scenarios from spec.md |
| **Priority** | P1 (all MVP — single feature delivery) |
| **Est. Tasks** | 21 |

### User Story Map

| Label | Scenario | Description |
|-------|----------|-------------|
| S1 | Browsing a Section | Section landing page with category cards |
| S2 | Browsing a Category | Category landing page with subcategory + content cards |
| S3 | Browsing a Subcategory | Subcategory landing page with content cards |
| S4 | Breadcrumb Navigation | Clickable breadcrumb segments at all levels |
| S5 | Branch Mode | Landing pages work with branch-specific content |
| S6 | Editing Landing Page Body | Editable overview bodies with inline editor |
| S7 | Sidebar Interaction | Sidebar click navigates to landing pages |

### Phase Mapping (tasks.md → plan.md)

| tasks.md Phase | plan.md Phase | Notes |
|---------------|---------------|-------|
| Phase 1: Data Model & Backend Foundation | Phase 1 (T001-T003) | Schema + types subset |
| Phase 2: Backend API Routes | Phase 1 (T004-T008) | Routes + services subset |
| Phase 3: Frontend Foundation | Phase 2 (T009-T011) | API service + hooks + cards |
| Phase 4: Landing Page Components | Phase 2 (T012-T014) | Page components subset |
| Phase 5: Navigation Integration | Phase 3 (T015-T019) | Wiring + navigation |
| Phase 6: Polish & E2E | Phase 3 (T020) | E2E tests subset |

> tasks.md uses 6 phases (finer granularity) vs plan.md's 3 phases for more precise dependency tracking and checkpoint validation.

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

## Phase 1: Data Model & Backend Foundation — ✅ Completed 🎯

**Beads Phase ID**: `echo-portal-dha8`
**Purpose**: New tables, schema changes, shared types — foundation for all backend routes
**Blocks**: Phase 2 (Backend Routes), Phase 3 (Frontend)
**Parallelism**: T001, T002, T003 all parallelizable

- [X] T001 [P] Create `section_pages` and `category_pages` tables in `backend/src/db/schema/landing-pages.ts` and export from `backend/src/db/schema/index.ts`
- [X] T002 [P] Add `body` column to subcategories table in `backend/src/db/schema/subcategories.ts`
- [X] T003 [P] Define landing page DTOs in `shared/types/landing-pages.ts`, extend `FileDiff` in `shared/types/comparison.ts`, add `body` to `SubcategoryDTO`

**✓ Checkpoint**: `npm run db:generate` produces valid migration SQL. All types compile. No TS errors.

---

## Phase 2: Backend API Routes — ✅ Completed 🎯

**Beads Phase ID**: `echo-portal-py8m`
**Purpose**: CRUD routes for section/category pages, extend subcategory routes, comparison + publish support
**Blocks**: Phase 4 (Frontend Integration)
**Dependencies**: Phase 1 complete
**Parallelism**: T004, T005, T006 parallelizable; T007 depends on T004-T006; T008 depends on T007

- [X] T004 [P] [S1] [S6] Implement section pages CRUD routes (`GET/PUT /api/v1/section-pages/:section`) in `backend/src/api/routes/section-pages.ts` with integration tests in `backend/tests/integration/section-pages.test.ts`
- [X] T005 [P] [S2] [S6] Implement category pages CRUD routes (`GET/PUT /api/v1/category-pages/:categoryId`) in `backend/src/api/routes/category-pages.ts` with integration tests in `backend/tests/integration/category-pages.test.ts`
- [X] T006 [P] [S3] Extend subcategory routes to include `body` field in GET response and accept `body` in PATCH in `backend/src/api/routes/subcategories.ts` with tests in `backend/tests/integration/subcategory-body.test.ts`
- [X] T007 [S5] Extend content comparison service to include landing page diffs in `backend/src/services/review/content-comparison-service.ts` with tests in `backend/tests/integration/landing-page-comparison.test.ts`
- [X] T008 [S5] Extend branch publish to upsert landing page bodies from branch to main in `backend/src/services/convergence/convergence-service.ts` with tests in `backend/tests/integration/landing-page-publish.test.ts`

**✓ Checkpoint**: All backend routes respond correctly. `npx vitest run` passes for new test files. Comparison and publish handle landing page bodies.

---

## Phase 3: Frontend Foundation — ✅ Completed 🎯

**Beads Phase ID**: `echo-portal-hq7o`
**Purpose**: API service, data hooks, reusable card grid component
**Blocks**: Phase 4 (Landing Page Components)
**Dependencies**: Phase 1 (T003 — shared types)
**Parallelism**: T009 → T010 sequential; T011 independent

- [X] T009 Create frontend API service for landing page endpoints in `frontend/src/services/landing-page-api.ts`
- [X] T010 Create TanStack Query hooks for section/category page data in `frontend/src/hooks/useLandingPages.ts`
- [X] T011 [P] Create `LandingPageCardGrid` component with CategoryCard, SubcategoryCard, and ContentItemCard variants in `frontend/src/components/library/LandingPageCardGrid.tsx` and `frontend/src/components/library/LandingPageCardGrid.module.css` with tests in `frontend/tests/unit/components/LandingPageCardGrid.test.tsx`. Cards must be keyboard navigable (focusable, Enter/Space to activate), use semantic HTML (list/listitem or grid role), and include appropriate ARIA labels for screen readers. ContentItemCard must support an optional `isDraft` prop that renders a "Draft" badge when true. Card grid must render without visible layout shifts (use fixed-height card skeletons or CSS containment).

**✓ Checkpoint**: Card grid renders correctly with all card types. Hooks follow existing TanStack Query patterns.

---

## Phase 4: Landing Page Components — ✅ Completed 🎯

**Beads Phase ID**: `echo-portal-b2yy`
**Purpose**: Section, category, and subcategory landing page components
**Dependencies**: Phase 3 complete (T010, T011)
**Parallelism**: T012, T013, T014 all parallelizable

- [X] T012 [P] [S1] Create `SectionLandingPage` component with section title, breadcrumb, body, and category card grid in `frontend/src/components/library/SectionLandingPage.tsx` and `frontend/src/components/library/SectionLandingPage.module.css` with tests in `frontend/tests/unit/components/SectionLandingPage.test.tsx`. Ensure logical tab order, ARIA landmarks for page regions (navigation breadcrumb, body content, card grid), and screen reader announcement of hierarchy level.
- [X] T013 [P] [S2] Create `CategoryLandingPage` component with category title, breadcrumb, body, and mixed card grid (subcategories + content items) in `frontend/src/components/library/CategoryLandingPage.tsx` and `frontend/src/components/library/CategoryLandingPage.module.css` with tests in `frontend/tests/unit/components/CategoryLandingPage.test.tsx`. Ensure logical tab order, ARIA landmarks for page regions (navigation breadcrumb, body content, card grid), and screen reader announcement of hierarchy level.
- [X] T014 [P] [S3] Create `SubcategoryLandingPage` component with subcategory title, breadcrumb, body, and content item cards in `frontend/src/components/library/SubcategoryLandingPage.tsx` and `frontend/src/components/library/SubcategoryLandingPage.module.css` with tests in `frontend/tests/unit/components/SubcategoryLandingPage.test.tsx`. Ensure logical tab order, ARIA landmarks for page regions (navigation breadcrumb, body content, card grid), and screen reader announcement of hierarchy level.

**✓ Checkpoint**: All three landing page components render correctly with proper breadcrumbs, bodies, and card grids. Edit button visibility follows permission rules.

---

## Phase 5: Navigation Integration — ✅ Completed 🎯

**Beads Phase ID**: `echo-portal-ec6l`
**Purpose**: Wire landing pages into Library.tsx, sidebar, breadcrumb, and header nav
**Dependencies**: Phase 2 complete (backend ready), Phase 4 complete (components ready)
**Parallelism**: T015 first, then T016-T019 parallelizable

- [X] T015 [S1] [S2] [S3] Integrate landing page view mode in `frontend/src/pages/Library.tsx` — add URL param detection, landing page level resolution, conditional rendering of landing page components, hide right sidebar, remove auto-select-first-content behavior. Verify FR-7: each landing page level has a distinct bookmarkable URL, direct navigation to URLs works, browser back/forward navigation works correctly. Landing pages must render within the same performance envelope as the current content view — no additional blocking requests before initial paint.
- [X] T016 [S6] Integrate landing page edit mode in `frontend/src/pages/Library.tsx` — handle onEditRequest, enter InlineEditView with landing page body, wire auto-save to correct PUT endpoint, permission checks
- [X] T016b [P] [S5] Update `DiffViewer` and `FileDiffList` to handle landing page `fileType` entries — render "Section: X" / "Category: X" / "Subcategory: X" labels from `path`, add landing page icon or badge to differentiate from content diffs in `frontend/src/components/diff/DiffViewer.tsx` and `frontend/src/components/diff/FileDiffList.tsx`
- [X] T017 [P] [S7] Update `LibrarySidebar` to fire `onSelectCategory`/`onSelectSubcategory` callbacks on click, add active state highlighting for category/subcategory nodes in `frontend/src/components/library/LibrarySidebar.tsx` with tests in `frontend/tests/unit/components/LibrarySidebar-navigation.test.tsx`
- [X] T018 [P] [S4] Make `ContentBreadcrumb` segments clickable — ancestor segments become links to landing page URLs in `frontend/src/components/library/ContentBreadcrumb.tsx` with tests in `frontend/tests/unit/components/ContentBreadcrumb.test.tsx`
- [X] T019 [P] [S7] Update `HeaderNav` section label clicks to navigate to section landing pages in `frontend/src/components/layout/HeaderNav.tsx`

**✓ Checkpoint**: Full navigation flow works — header → section → category → subcategory → content. Breadcrumbs navigate back up. Sidebar clicks navigate to landing pages. Edit mode works for authorized users in draft branches.

---

## Phase 6: Polish & E2E — ✅ Completed

**Beads Phase ID**: `echo-portal-bq59`
**Purpose**: End-to-end integration tests covering the full flow
**Dependencies**: Phase 5 complete

- [X] T020 Write end-to-end Playwright tests covering full navigation flow, card interactions, breadcrumb navigation, sidebar clicks, branch mode editing, review diff inclusion, and URL consistency (direct navigation to each landing page URL, browser back/forward between levels) in `frontend/tests/e2e/landing-pages.spec.ts`

**✓ Checkpoint**: All e2e tests pass. Feature is production-ready.

---

## Dependency Graph

```
Phase 1: Schema & Types (T001-T003)
    │
    ├────────────────────────────────────┐
    ▼                                    ▼
Phase 2: Backend APIs (T004-T008)   Phase 3: Frontend Foundation (T009-T011)
    │                                    │
    │                                    ▼
    │                               Phase 4: Landing Page Components (T012-T014)
    │                                    │
    └──────────────┬─────────────────────┘
                   ▼
          Phase 5: Navigation Integration (T015-T019)
                   │
                   ▼
          Phase 6: Polish & E2E (T020)
```

### Intra-Phase Dependencies

```
Phase 2:
  T004 ─┬─ T007 ─── T008
  T005 ─┤
  T006 ─┘

Phase 3:
  T009 ─── T010
  T011 (independent)

Phase 5:
  T015 ─── T016
  T017 (independent, parallel with T015)
  T018 (independent, parallel with T015)
  T019 (independent, parallel with T015)
```

---

## Execution Strategy

### Recommended: Sequential Priority (Solo Developer)

```
Phase 1 (T001-T003, parallel) → Phase 2 (T004-T008) + Phase 3 (T009-T011, parallel with Phase 2)
→ Phase 4 (T012-T014, parallel) → Phase 5 (T015-T019) → Phase 6 (T020)
```

### Parallel Opportunities

| Stage | Parallel Tasks | Notes |
|-------|---------------|-------|
| Schema & Types | T001, T002, T003 | Different files, no deps |
| Backend Routes | T004, T005, T006 | Different route files |
| Frontend Foundation + Backend Routes | Phase 3 alongside Phase 2 | Frontend only needs T003 types |
| Landing Page Components | T012, T013, T014 | Different component files |
| Navigation Integration | T017, T018, T019 alongside T015 | Different component files |

---

## Beads ID Mapping

| Task ID | Beads ID | Description |
|---------|----------|-------------|
| T001 | `echo-portal-st2h` | Schema — section_pages and category_pages tables |
| T002 | `echo-portal-n67w` | Schema — Add body column to subcategories |
| T003 | `echo-portal-wj6y` | Shared types — Landing page DTOs |
| T004 | `echo-portal-uawx` | Backend routes — Section pages CRUD |
| T005 | `echo-portal-2zb9` | Backend routes — Category pages CRUD |
| T006 | `echo-portal-mzm1` | Backend — Extend subcategory routes with body |
| T007 | `echo-portal-s7or` | Backend — Extend content comparison for diffs |
| T008 | `echo-portal-7wbz` | Backend — Extend branch publish for bodies |
| T009 | `echo-portal-tw6q` | Frontend API service — Landing page endpoints |
| T010 | `echo-portal-srhs` | Frontend hooks — Landing page data hooks |
| T011 | `echo-portal-5a39` | Frontend component — LandingPageCardGrid |
| T012 | `echo-portal-31ll` | Frontend component — SectionLandingPage |
| T013 | `echo-portal-1rxo` | Frontend component — CategoryLandingPage |
| T014 | `echo-portal-cdcd` | Frontend component — SubcategoryLandingPage |
| T015 | `echo-portal-0b7w` | Library.tsx — Landing page view mode |
| T016 | `echo-portal-r90q` | Library.tsx — Landing page edit mode |
| T016b | `echo-portal-x6ii` | DiffViewer/FileDiffList — Landing page fileType handling |
| T017 | `echo-portal-sb7x` | LibrarySidebar — Category/subcategory click nav |
| T018 | `echo-portal-zn0l` | ContentBreadcrumb — Clickable segments |
| T019 | `echo-portal-70pa` | HeaderNav — Section label click navigation |
| T020 | `echo-portal-4x6l` | End-to-end integration tests |

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[Sn]` labels map tasks to user scenarios from spec.md
- Phase 2 and Phase 3 can run in parallel (frontend only needs shared types from T003)
- All landing page components share the same pattern: title, breadcrumb, optional body, card grid
- The editing experience reuses existing InlineEditView — no new editor components needed
- Subcategory body is simpler than section/category (no separate table — just a column on existing entity)
- Category content counts come from the existing `useCategories()` hook in `frontend/src/hooks/usePublishedContent.ts` — no new backend endpoint needed
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state
