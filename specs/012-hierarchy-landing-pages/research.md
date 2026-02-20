# Research: 012 Hierarchy Landing Pages

## Decision 1: Landing Page Body Storage Model

**Decision:** Three separate storage mechanisms:
- `section_pages` table — new table, one row per section per branch
- `category_pages` table — new table, one row per category per branch
- `subcategories.body` column — new column on existing branch-scoped table

**Rationale:** Categories are global (not branch-scoped), so their editorial content must live in a separate branch-scoped table. Subcategories are already branch-scoped, so a simple column addition suffices. Sections have no DB row, requiring their own table.

**Alternatives considered:**
- Single `landing_pages` table for all types → rejected: polymorphic FK is messier than three focused tables
- Adding `body` to categories directly → rejected: categories are global, body must be branch-scoped
- Storing as regular content items → rejected: landing pages aren't content items (no slug, no version history, no content type)

## Decision 2: Version History for Landing Page Bodies

**Decision:** No version history — single current body per branch. Bodies are overwritten on each save.

**Rationale:** Content items need version history for audit and revert. Landing page bodies are supplementary overview text, not primary content. The branch workflow itself provides a safe editing model (drafts → review → publish). Adding version history would require additional tables and complexity for low-value text.

**Alternatives considered:**
- Full `content_versions`-style versioning → rejected: over-engineering for overview text
- Git-backed versioning → rejected: inconsistent with DB-first model

## Decision 3: Published State for Landing Page Bodies

**Decision:** Published bodies are stored on the main branch (branch_id = main branch UUID). Publishing copies branch bodies to main branch, following the same pattern as content.

**Rationale:** The existing convergence/publish service copies content from branch to main. Landing page bodies follow the same model — branch rows are the draft, main branch rows are the published version.

**Alternatives considered:**
- Null branch_id for published → rejected: inconsistent with content model where everything belongs to a branch
- Separate `is_published` flag → rejected: the branch_id already determines published status (main branch = published)

## Decision 4: API Endpoint Structure

**Decision:** Three endpoint groups following REST conventions:
- `GET/PUT /api/v1/section-pages/:section?branchId=` — read/update section page body
- `GET/PUT /api/v1/category-pages/:categoryId?branchId=` — read/update category page body
- Subcategory body delivered via existing subcategory GET endpoint (add `body` field to response)

**Rationale:** Section and category pages need dedicated endpoints since they're new tables. Subcategory body is just a field on an existing entity. PUT (not POST) because there's exactly one body per entity per branch — create-or-update semantics.

**Alternatives considered:**
- Unified `/landing-pages` endpoint with type discriminator → rejected: three different backing tables make this an awkward abstraction
- POST for creation, PUT for update → rejected: upsert is simpler since there's exactly one body per entity per branch

## Decision 5: Content Comparison Extension

**Decision:** Extend `getContentComparison()` to include landing page body diffs as additional `FileDiff` entries with a new `fileType` discriminator.

**Rationale:** The review diff view already renders `FileDiff[]`. Adding landing page diffs as additional entries (with `fileType: 'section_page' | 'category_page' | 'subcategory_page'`) means the existing `ReviewDiffView` component can render them with minimal changes.

**Alternatives considered:**
- Separate API endpoint for landing page diffs → rejected: fragments the review experience
- Inline in content diffs → rejected: landing pages aren't content items

## Decision 6: Frontend Component Architecture

**Decision:** Three new landing page components (`SectionLandingPage`, `CategoryLandingPage`, `SubcategoryLandingPage`) rendered conditionally in Library.tsx, with a shared `LandingPageCardGrid` component. Rendered when URL indicates a node is selected but no content slug is present.

**Rationale:** Follows the existing pattern where `ContentRenderer`, `ReviewDiffView`, and `InlineEditView` are conditionally rendered in the Library page's content area. Each landing page is its own component to keep complexity manageable.

**Alternatives considered:**
- Single `LandingPage` component with type prop → rejected: the three levels have different enough content (categories vs subcategories+content vs content) to warrant separate components
- Separate routes outside Library → rejected: breaks the sidebar + content area layout pattern

## Decision 7: URL Pattern for Subcategory Selection

**Decision:** Add `&subcategoryId=xxx` query parameter. Full pattern:
- Section: `/library?section=brands`
- Category: `/library?section=brands&category=Vehicles`
- Subcategory: `/library?section=brands&category=Vehicles&subcategoryId=xxx`
- Content: `/library/content-slug`

**Rationale:** Extends existing query parameter pattern. Using subcategory ID (not name) avoids uniqueness issues and matches the existing `categoryId`/`subcategoryId` fields on content.

**Alternatives considered:**
- Path-based routes (`/library/brands/vehicles/suvs`) → rejected: major routing refactor, breaks existing slug-based content URLs
- Subcategory name in query → rejected: names may not be unique across categories
