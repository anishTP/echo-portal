# Implementation Plan: 012 Hierarchy Landing Pages

**Feature ID:** 012-hierarchy-landing-pages
**Branch:** 012-hierarchy-landing-pages
**Spec:** [spec.md](./spec.md)
**Data Model:** [data-model.md](./data-model.md)
**API Contracts:** [contracts/api-contracts.md](./contracts/api-contracts.md)
**Research:** [research.md](./research.md)

---

## Phase 1: Data Model & Backend APIs

Backend-only changes. Independently testable with integration tests.

### T001: Schema — section_pages and category_pages tables

**Files:**
- `backend/src/db/schema/landing-pages.ts` (new)
- `backend/src/db/schema/index.ts` (add exports)

**Work:**
- Define `sectionPages` table: id, section (content_section enum), branch_id (FK), body (text, default ''), created_by (FK), created_at, updated_at
- Define `categoryPages` table: id, category_id (FK → categories, CASCADE), branch_id (FK → branches, CASCADE), body (text, default ''), created_by (FK), created_at, updated_at
- Add unique indexes: `(section, branch_id)` and `(category_id, branch_id)`
- Export from schema index

**Acceptance:** `npm run db:generate` produces valid migration SQL. Schema compiles with no TS errors.

### T002: Schema — Add body column to subcategories

**Files:**
- `backend/src/db/schema/subcategories.ts`

**Work:**
- Add `body: text('body').notNull().default('')` column to subcategories table
- Run `npm run db:generate` to create migration

**Acceptance:** Migration adds `body` column with default empty string. Existing subcategory tests still pass.

### T003: Shared types — Landing page DTOs

**Files:**
- `shared/types/landing-pages.ts` (new)
- `shared/types/index.ts` (add export)
- `shared/types/comparison.ts` (extend FileDiff)

**Work:**
- Define `SectionPageDTO`, `CategoryPageDTO` interfaces
- Add `body` field to `SubcategoryDTO` (in existing subcategory type file)
- Add `fileType?: 'content' | 'section_page' | 'category_page' | 'subcategory_page'` to `FileDiff`
- Add `landingPageId?: string` to `FileDiff`

**Acceptance:** All types compile. No breaking changes to existing type consumers.

### T004: Backend routes — Section pages CRUD

**Files:**
- `backend/src/api/routes/section-pages.ts` (new)
- `backend/src/api/index.ts` (register routes)

**Work:**
- `GET /api/v1/section-pages/:section` — read with fallback to published (main branch)
- `PUT /api/v1/section-pages/:section` — upsert body for a branch (admin only, draft branch only)
- Zod validation: section param must be valid enum, branchId must be valid UUID
- Auth: GET is public, PUT requires admin role + draft branch
- Fallback logic: query branch row → if not found, query main branch row → if not found, return empty

**Tests:** `backend/tests/integration/section-pages.test.ts`
- GET returns empty body when no page exists
- GET returns branch body when branch override exists
- GET falls back to published body when no branch override
- PUT creates section page on first save
- PUT updates existing section page
- PUT rejects non-admin users
- PUT rejects non-draft branches

### T005: Backend routes — Category pages CRUD

**Files:**
- `backend/src/api/routes/category-pages.ts` (new)
- `backend/src/api/index.ts` (register routes)

**Work:**
- `GET /api/v1/category-pages/:categoryId` — read with fallback to published
- `PUT /api/v1/category-pages/:categoryId` — upsert body (admin only, draft branch)
- Same patterns as T004 but keyed on categoryId instead of section enum

**Tests:** `backend/tests/integration/category-pages.test.ts`
- Same test matrix as T004, adapted for category pages

### T006: Backend — Extend subcategory routes with body field

**Files:**
- `backend/src/api/routes/subcategories.ts`

**Work:**
- Include `body` field in GET response (list and individual)
- Accept optional `body` field in PATCH (rename/update) endpoint
- Return updated body in response

**Tests:** `backend/tests/integration/subcategory-body.test.ts`
- GET returns body field (empty string default)
- PATCH updates body when provided
- PATCH leaves body unchanged when omitted

### T007: Backend — Extend content comparison for landing page diffs

**Files:**
- `backend/src/services/review/content-comparison-service.ts`

**Work:**
- After generating content diffs, query `section_pages` and `category_pages` with branch_id
- For each landing page row on the branch, compare body against main branch version
- Generate `FileDiff` entries with appropriate `fileType` and `path` labels (e.g., "Section: Brands", "Category: Vehicles")
- For subcategories: compare branch subcategory body against source subcategory body (if sourceContentId-like pattern exists) or against empty
- Append landing page diffs to `files[]` array
- Update `stats` (additions/deletions counts)

**Tests:** `backend/tests/integration/landing-page-comparison.test.ts`
- Comparison includes section page diff when branch has section page override
- Comparison includes category page diff when branch has category page override
- Comparison includes subcategory body diff when body has changed
- Comparison excludes landing pages with no changes
- Stats reflect landing page additions/deletions

### T008: Backend — Extend branch publish for landing page bodies

**Files:**
- `backend/src/services/convergence/convergence-service.ts` or content merge service

**Work:**
- After content merge step, upsert `section_pages` from branch → main branch
- After content merge step, upsert `category_pages` from branch → main branch
- Subcategory bodies: verify existing subcategory merge handles the new `body` column (should come along automatically with existing row copy)
- Delete branch-specific landing page rows after publish (cleanup)

**Tests:** `backend/tests/integration/landing-page-publish.test.ts`
- Publishing branch with section page override copies body to main
- Publishing branch with category page override copies body to main
- Publishing branch with subcategory body changes propagates to main
- Published landing page bodies are readable via GET without branchId

---

## Phase 2: Frontend Landing Page Components

Frontend-only changes (using mocked data where backend isn't available yet). Independently testable with component tests.

### T009: Frontend API service — Landing page endpoints

**Files:**
- `frontend/src/services/landing-page-api.ts` (new)

**Work:**
- `sectionPageApi.get(section, branchId?)` → `GET /section-pages/:section`
- `sectionPageApi.update(section, branchId, body)` → `PUT /section-pages/:section`
- `categoryPageApi.get(categoryId, branchId?)` → `GET /category-pages/:categoryId`
- `categoryPageApi.update(categoryId, branchId, body)` → `PUT /category-pages/:categoryId`

**Acceptance:** Type-safe API calls matching contracts. No runtime testing needed (covered by hook tests).

### T010: Frontend hooks — Landing page data hooks

**Files:**
- `frontend/src/hooks/useLandingPages.ts` (new)

**Work:**
- `landingPageKeys` query key factory
- `useSectionPage(section, branchId?)` — TanStack query hook
- `useCategoryPage(categoryId, branchId?)` — TanStack query hook
- `useUpdateSectionPage()` — mutation with cache invalidation
- `useUpdateCategoryPage()` — mutation with cache invalidation
- Subcategory body comes from existing subcategory hook (already has data after T006)

**Acceptance:** Hooks follow existing patterns (staleTime, enabled flag, invalidation).

### T011: Frontend component — LandingPageCardGrid

**Files:**
- `frontend/src/components/library/LandingPageCardGrid.tsx` (new)
- `frontend/src/components/library/LandingPageCardGrid.module.css` (new)

**Work:**
- Generic card grid component accepting mixed card types
- `CategoryCard`: name, content count, onClick → navigate to category
- `SubcategoryCard`: name, content count, onClick → navigate to subcategory
- `ContentItemCard`: title, description excerpt (truncated ~120 chars), content type badge, author name, onClick → navigate to content
- Responsive grid: 3 columns on wide, 2 on medium, 1 on narrow
- Empty state when no cards

**Tests:** `frontend/tests/unit/components/LandingPageCardGrid.test.tsx`
- Renders category cards with name and count
- Renders content item cards with title, excerpt, badge, author
- Renders empty state when no items
- Click handlers fire correctly

### T012: Frontend component — SectionLandingPage

**Files:**
- `frontend/src/components/library/SectionLandingPage.tsx` (new)
- `frontend/src/components/library/SectionLandingPage.module.css` (new)

**Work:**
- Props: section, categories (CategoryDTO[]), categoryCounts, body (from hook), onEditRequest, canEdit, branchMode
- Renders: section title, breadcrumb (section only), body (markdown via Markdown component), card grid of categories
- Empty body: editors see "Add overview" prompt, viewers see cards at top
- Edit button visible for admins in draft branch

**Tests:** `frontend/tests/unit/components/SectionLandingPage.test.tsx`
- Renders section title and breadcrumb
- Renders body content when present
- Shows "Add overview" for editors when body empty
- Hides body area for viewers when body empty
- Renders category cards with counts
- Edit button visible for admins in draft branch
- Edit button hidden for non-admins

### T013: Frontend component — CategoryLandingPage

**Files:**
- `frontend/src/components/library/CategoryLandingPage.tsx` (new)
- `frontend/src/components/library/CategoryLandingPage.module.css` (new)

**Work:**
- Props: category (CategoryDTO), subcategories, contentItems, body, onEditRequest, canEdit, branchMode, section
- Renders: category title, breadcrumb (section > category), body, uniform card grid (subcategory cards + content item cards)
- Same empty body pattern as SectionLandingPage

**Tests:** `frontend/tests/unit/components/CategoryLandingPage.test.tsx`
- Renders category title and breadcrumb with section
- Renders mixed card grid (subcategory + content cards)
- Body display and empty state behavior

### T014: Frontend component — SubcategoryLandingPage

**Files:**
- `frontend/src/components/library/SubcategoryLandingPage.tsx` (new)
- `frontend/src/components/library/SubcategoryLandingPage.module.css` (new)

**Work:**
- Props: subcategory (SubcategoryDTO), contentItems, body (from subcategory.body), onEditRequest, canEdit, branchMode, section, categoryName
- Renders: subcategory title, breadcrumb (section > category > subcategory), body, content item cards
- Same empty body pattern

**Tests:** `frontend/tests/unit/components/SubcategoryLandingPage.test.tsx`

---

## Phase 3: Navigation Integration

Wires everything together. Requires both Phase 1 and Phase 2.

### T015: Library.tsx — Landing page view mode integration

**Files:**
- `frontend/src/pages/Library.tsx`

**Work:**
- Add state: `selectedCategoryId`, `selectedSubcategoryId` (derived from URL params)
- Add view mode detection: `isLandingPageMode` = has section but no content slug and no content ID selected
- Determine landing page level: section-only → SectionLandingPage, section+category → CategoryLandingPage, section+category+subcategory → SubcategoryLandingPage
- Fetch landing page bodies via new hooks (T010)
- Render landing page components in the conditional chain (before ContentRenderer)
- Pass resolved data (categories, subcategories, content items, body, permissions)
- Hide right sidebar when landing page is active
- Remove auto-select-first-content behavior when landing page should show
- Default `/library` (no params) to section=brands

**Acceptance:** Navigating to `/library?section=brands` shows SectionLandingPage. Navigating to `/library?section=brands&category=Vehicles` shows CategoryLandingPage. No auto-selection of content.

### T016: Library.tsx — Landing page edit mode integration

**Files:**
- `frontend/src/pages/Library.tsx`

**Work:**
- Handle `onEditRequest` from landing page components
- Enter edit mode with InlineEditView, passing landing page body as content
- Wire auto-save to the appropriate PUT endpoint (section-pages or category-pages)
- Handle done/cancel to exit edit mode and return to landing page view
- Permission checks: admin for section/category, contributor+ for subcategory

**Acceptance:** Clicking Edit on a landing page enters InlineEditView. Saving persists to the correct endpoint. Exiting returns to landing page view with updated body.

### T016b: Frontend — Review diff view for landing page diffs

**Files:**
- `frontend/src/components/diff/DiffViewer.tsx`
- `frontend/src/components/diff/FileDiffList.tsx`

**Work:**
- Handle `fileType` field on `FileDiff` entries
- When `fileType` is `'section_page'`, `'category_page'`, or `'subcategory_page'`, render the diff with a landing page icon/badge to distinguish from content diffs
- Use `path` field for display label (e.g., "Section: Brands")
- Existing hunk rendering works as-is (body is text, diffs are hunks)

**Acceptance:** Landing page diffs appear in review diff view with correct labels. Content diffs are unaffected.

### T017: LibrarySidebar — Category/subcategory click navigation

**Files:**
- `frontend/src/components/library/LibrarySidebar.tsx`

**Work:**
- Add `onSelectCategory?: (categoryId: string) => void` and `onSelectSubcategory?: (subcategoryId: string) => void` callbacks to props
- Category click: expand node AND call `onSelectCategory`
- Subcategory click: expand node AND call `onSelectSubcategory`
- Add active state for category/subcategory nodes (not just content items)
- Visual highlight for active category/subcategory
- Re-clicking an active node toggles collapse but does NOT navigate away

**Tests:** `frontend/tests/unit/components/LibrarySidebar-navigation.test.tsx`
- Category click fires onSelectCategory callback
- Subcategory click fires onSelectSubcategory callback
- Active category is visually highlighted
- Re-click on active category toggles collapse

### T018: ContentBreadcrumb — Clickable segments

**Files:**
- `frontend/src/components/library/ContentBreadcrumb.tsx`
- `frontend/src/components/library/ContentRenderer.module.css`

**Work:**
- Add props: `sectionValue?: string`, `categoryId?: string`, `subcategoryId?: string`
- Each ancestor segment becomes a `<Link>` to the appropriate URL:
  - Section → `/library?section={plural}`
  - Category → `/library?section={plural}&category={name}`
  - Subcategory → `/library?section={plural}&category={name}&subcategoryId={id}`
- Current page (last segment) stays as plain `<span>`
- Style clickable segments with link color and hover underline
- Also render breadcrumbs on landing pages (not just content pages)

**Tests:** `frontend/tests/unit/components/ContentBreadcrumb.test.tsx`
- Ancestor segments render as links with correct hrefs
- Current page segment is not a link
- Renders correctly for each page level (section, category, subcategory, content)

### T019: HeaderNav — Section label and category click navigation

**Files:**
- `frontend/src/components/layout/HeaderNav.tsx`

**Work:**
- Clicking the section label (e.g., "Brands" text) navigates to `/library?section=brands` (section landing page)
- Category clicks in dropdowns already navigate to `/library?section=brands&category=X` — this now naturally renders CategoryLandingPage instead of auto-selecting content (no change needed if T015 is done)
- Verify the navigation works correctly end-to-end

**Acceptance:** Clicking "Brands" label goes to section landing page. Clicking a category in dropdown goes to category landing page.

### T020: End-to-end integration tests

**Files:**
- `frontend/tests/e2e/landing-pages.spec.ts` (new)

**Work:**
- Navigate to `/library` → see Brands section landing page
- Click category card → see category landing page with subcategory + content cards
- Click subcategory card → see subcategory landing page with content cards
- Click content card → see content view
- Click breadcrumb segment → navigate back up hierarchy
- Sidebar category click → navigate to category landing page
- Branch mode: edit a landing page body, verify save, verify review diff includes it

---

## Task Dependency Graph

```
T001 ─┬─ T004 (section pages routes)
      │
T002 ─┼─ T005 (category pages routes)
      │    │
T003 ─┘    ├─ T007 (comparison extension) ─── T008 (publish extension)
           │
T006 ──────┘

T009 ─── T010 ─┬─ T012 (SectionLandingPage)
               │
T011 ──────────┼─ T013 (CategoryLandingPage)
               │
               └─ T014 (SubcategoryLandingPage)

T012 ─┬─ T015 (Library integration - view)
T013 ─┤
T014 ─┘    ├─ T016 (Library integration - edit)
           │
T017 ──────┤  (sidebar navigation)
T018 ──────┤  (breadcrumb links)
T019 ──────┤  (header nav)
           │
           └─ T020 (e2e tests) — depends on all above
```

## Summary

| Phase | Tasks | Scope |
|-------|-------|-------|
| Phase 1: Backend | T001–T008 | 2 new tables, 1 column, 4 route files, comparison + publish extension |
| Phase 2: Frontend Components | T009–T014 | API service, hooks, 4 new components with tests |
| Phase 3: Navigation Integration | T015–T020 | Library.tsx wiring, sidebar, breadcrumb, header nav, e2e |
| **Total** | **20 tasks** | |
