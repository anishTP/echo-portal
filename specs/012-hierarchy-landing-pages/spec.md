# Feature Specification: Hierarchy Landing Pages

**Feature ID**: 012-hierarchy-landing-pages
**Status**: Planned
**Created**: 2026-02-20
**Last Updated**: 2026-02-20

## Problem Statement

The echo-portal Library displays content only at the leaf level of the navigation tree. When users click a category or subcategory in the sidebar, the node merely expands or collapses — no overview or listing is shown. When navigating from the header to a section with a category filter (e.g., Brands > Vehicles), the app auto-selects the first content item instead of showing what the category contains. This creates a disjointed experience: users cannot browse or scan content at any level above individual articles.

Users expect that clicking "Vehicles" shows them everything in the Vehicles category before they drill into a specific article. The current behavior forces users to expand folders and hunt through the sidebar tree to understand what content exists at each level.

## Goal

Every level of the content tree — **Section**, **Category**, and **Subcategory** — has its own landing page that provides an overview of its children, giving users a consistent and predictable navigation experience at every depth.

## Content Hierarchy

```
Section (Brands | Products | Experiences)
  └─ Category (persistent, admin-created)
       ├─ Subcategory (branch-scoped, contributor-created)
       │    └─ Content items (guidelines, assets, opinions)
       └─ Loose content items (directly under category, no subcategory)
```

## User Scenarios & Acceptance Criteria

### Scenario 1: Browsing a Section

**Actor**: Any authenticated or unauthenticated user

**Flow**:
1. User clicks "Brands" in the header navigation
2. The Library page displays a **Section Landing Page** showing all categories within Brands
3. Each category is displayed as a card showing the category name and the number of published content items it contains
4. User clicks a category card to navigate to that category's landing page

**Acceptance Criteria**:
- Section landing page renders when navigating to a section without selecting a specific content item or category
- All categories within the section are displayed, ordered by their display order
- Each category card shows the category name and total content count (including content in subcategories)
- Empty categories are shown with a count of zero
- Clicking a category card navigates to the category landing page
- The sidebar reflects the current section context (shows categories for this section)

### Scenario 2: Browsing a Category

**Actor**: Any user

**Flow**:
1. User clicks a category name in the sidebar or arrives via a category card on the section page
2. The Library page displays a **Category Landing Page** with an editable overview body at the top
3. Below the body, subcategory cards and loose content item cards appear in a uniform grid
4. User clicks a subcategory card to navigate to the subcategory landing page
5. User clicks a content item card to view the full content

**Acceptance Criteria**:
- Category landing page renders when a category is selected without a specific content item
- An editable overview body is displayed at the top (visible to editors; hidden for viewers when empty)
- Below the body, subcategories and loose content items are displayed as a uniform card grid
- Subcategory cards show the subcategory name and content count
- Content item cards show title, description excerpt, content type badge, and author
- Cards are ordered by display order
- Clicking a subcategory card navigates to the subcategory landing page
- Clicking a content item card navigates to the full content view
- The page shows an empty state when the category has no subcategories or content

### Scenario 3: Browsing a Subcategory

**Actor**: Any user

**Flow**:
1. User clicks a subcategory name in the sidebar or a subcategory heading on the category page
2. The Library page displays a **Subcategory Landing Page** listing all content items in that subcategory
3. Each content item shows its title, description, content type badge, and author
4. User clicks a content item to view it

**Acceptance Criteria**:
- Subcategory landing page renders when a subcategory is selected without a specific content item
- All content items within the subcategory are listed, ordered by display order
- Each item shows: title, description (truncated if long), content type badge, and author name
- An empty state is shown when the subcategory has no content
- Clicking a content item navigates to the full content view

### Scenario 4: Navigating via Breadcrumb

**Actor**: Any user viewing content at any level

**Flow**:
1. User is viewing an individual content item with breadcrumb: Brands > Vehicles > SUVs > Article Title
2. User clicks "Vehicles" in the breadcrumb
3. The category landing page for Vehicles is displayed
4. User clicks "Brands" in the breadcrumb
5. The section landing page for Brands is displayed

**Acceptance Criteria**:
- Each breadcrumb segment (except the current page) is clickable
- Section segment navigates to the section landing page
- Category segment navigates to the category landing page
- Subcategory segment navigates to the subcategory landing page
- The current page segment (rightmost) is not clickable and visually distinct
- Breadcrumbs appear on all page types: section, category, subcategory, and content pages

### Scenario 5: Landing Pages in Branch Mode

**Actor**: Contributor or admin working in a draft branch

**Flow**:
1. User is in branch mode (draft branch selected via branch selector)
2. User navigates to a category landing page
3. The landing page shows branch-specific content: draft items, new subcategories, and modified content
4. Content counts reflect the branch state, not just published content

**Acceptance Criteria**:
- Landing pages work identically in branch mode, showing branch content instead of published content
- New subcategories created in the branch appear on the category landing page
- Draft content items appear in listings with a subtle "Draft" badge on the content item card, consistent with the existing draft state indicators used elsewhere in the application (e.g., branch state badges)
- Content counts reflect the branch state
- Sidebar navigation and landing page content remain in sync

### Scenario 6: Editing a Landing Page Body

**Actor**: Admin (for section/category pages) or contributor+ (for subcategory pages) in a draft branch

**Flow**:
1. User navigates to a category landing page while in a draft branch
2. User clicks the Edit button (or "Add overview" prompt if body is empty)
3. The full inline editor opens with the EditModeHeader toolbar, identical to content editing
4. User writes or modifies the overview body
5. Changes auto-save to the branch
6. User clicks Done to exit edit mode and return to the landing page view

**Acceptance Criteria**:
- The Edit button appears on landing pages for users with sufficient permissions while in a draft branch
- Clicking Edit enters the same full inline editor used for content items (EditModeHeader, auto-save, undo/redo)
- The "Add overview" prompt (for empty bodies) also enters edit mode on click
- Changes are saved to the branch and appear in the landing page body on exit
- The Edit button is hidden when the branch is in review or approved state
- The Edit button is hidden for users without sufficient permissions

### Scenario 7: Sidebar Interaction with Landing Pages

**Actor**: Any user

**Flow**:
1. User clicks a category name in the sidebar
2. The category node expands in the sidebar AND the category landing page renders in the main content area
3. User clicks a subcategory name in the sidebar
4. The subcategory node expands AND the subcategory landing page renders

**Acceptance Criteria**:
- Clicking a category in the sidebar both expands it and navigates to its landing page
- Clicking a subcategory in the sidebar both expands it and navigates to its landing page
- The active node in the sidebar is visually highlighted to match the current landing page
- Re-clicking an already-active category/subcategory toggles collapse without navigating away
- Content items in the sidebar continue to navigate directly to the content view

## Functional Requirements

### FR-1: Section Landing Page
- The system shall display a section landing page when the user navigates to a section without a category or content selection
- When navigating to `/library` with no section parameter, the system shall default to the first section (Brands) landing page
- The page shall display an editable rich text body providing an overview of the section
- Below the content body, the page shall list all categories in the section as cards, ordered by display order
- Each card shall show the category name and total content item count
- The page shall include a section title (e.g., "Brands") and breadcrumb
- The page shall show an empty state for the cards area when the section has no categories
- The right sidebar shall be hidden on section landing pages

### FR-2: Category Landing Page
- The system shall display a category landing page when the user selects a category without a specific content item
- The page shall display an editable rich text body providing an overview of the category
- The page shall show a category title and breadcrumb
- Below the content body, subcategories and loose content items shall be displayed as a uniform card grid
- Subcategory cards shall show the subcategory name and content count
- Content item cards shall show title, description excerpt, content type badge, and author
- Cards shall be ordered by display order
- The page shall show an empty state for the cards area when the category has no content or subcategories
- The right sidebar shall be hidden on category landing pages

### FR-3: Subcategory Landing Page
- The system shall display a subcategory landing page when the user selects a subcategory without a specific content item
- The page shall display an editable rich text body providing an overview of the subcategory
- The page shall show a subcategory title and breadcrumb
- Below the content body, all content items shall be listed as cards with: title, description excerpt, content type badge, and author
- The page shall show an empty state for the cards area when the subcategory has no content
- The right sidebar shall be hidden on subcategory landing pages

### FR-8: Editable Landing Page Content
- Each section, category, and subcategory shall have an associated rich text body that can be edited by authorized users
- Section overview bodies shall be stored in a new `section_pages` table (one row per section per branch), versioned via branches
- Category overview bodies shall be stored in a new `category_pages` table (one row per category per branch), keeping the category entity itself global and unchanged
- Subcategory overview bodies shall be stored as a new field on the subcategories table (subcategories are already branch-scoped)
- The editing experience shall use the same full inline editor used for content items, including EditModeHeader toolbar, auto-save, and undo/redo
- Landing page bodies shall participate in the branch workflow (editable in draft branches, published on branch publish)
- When the body is empty: editors with permission shall see a subtle "Add overview" prompt that enters edit mode on click; viewers without edit permission shall see no body area (child cards render directly at the top of the page)
- **Permissions**: Only administrators can edit section and category landing page bodies; contributors and above can edit subcategory landing page bodies
- The Edit button shall follow the same branch-gated flow as content items (requires a draft branch)

### FR-4: Breadcrumb Navigation
- Each breadcrumb segment for an ancestor level shall be a clickable link
- The current page segment shall be displayed as plain text (not clickable)
- Breadcrumbs shall be present on section, category, subcategory, and content pages
- Navigation via breadcrumb shall update both the main content area and sidebar state

### FR-5: Sidebar & Header Nav Integration
- Clicking a category in the sidebar shall expand the node and navigate to the category landing page
- Clicking a subcategory in the sidebar shall expand the node and navigate to the subcategory landing page
- The sidebar shall visually indicate which node corresponds to the current landing page
- Collapsing an active node shall not navigate away from the current landing page
- Clicking a category in the header nav dropdown shall navigate to the category landing page (consistent with sidebar behavior)
- Clicking a section label in the header nav shall navigate to the section landing page

### FR-6: Branch Mode Support
- All landing pages shall function in branch mode, displaying branch-specific content
- Content counts and listings shall reflect the branch state
- Draft and unpublished items shall appear in landing page listings
- Landing page body edits shall appear in the review diff view alongside content item diffs when a branch is submitted for review
- Landing page body changes shall be published when the branch is published, following the same lifecycle as content items

### FR-7: URL Consistency
- Each landing page level shall have a distinct, bookmarkable URL pattern
- Navigating directly to a landing page URL shall render the correct page
- Browser back/forward navigation shall work correctly across all page levels

## Non-Functional Requirements

### Performance
- Landing pages shall render their content within the same performance envelope as the current content view
- Category cards and content listings shall appear without visible layout shifts

### Accessibility
- All landing page cards and list items shall be keyboard navigable
- Screen readers shall announce the hierarchy level and navigation context
- Focus management shall follow logical tab order through cards and list items

### Responsiveness
- Landing pages shall adapt to the available content area width
- Category cards shall reflow from multi-column to single-column on narrow viewports

### Auditability
- Landing page body mutations are recorded via the `created_by` and `updated_at` fields on `section_pages`, `category_pages`, and `subcategories` rows
- The branch workflow provides an audit trail: all edits happen in a named branch owned by an identifiable user, reviewed before publish
- Landing page body changes appear in the branch comparison diff view (FR-6), providing pre-publish traceability
- No separate audit log table entries are required for landing page body edits — the branch lifecycle (draft → review → approved → published) satisfies traceability requirements

### Visibility Boundaries
- **Published state**: Landing page bodies on the main branch are visible to all users (including unauthenticated). GET endpoints for section/category pages are public.
- **Draft state**: Landing page bodies on non-main branches are visible only to authenticated users who have access to that branch. The `branchId` query parameter controls which version is returned.
- **Edit mode**: The Edit button and "Add overview" prompt are visible only to users with appropriate permissions (admin for section/category, contributor+ for subcategory) while on a draft branch. On published branches or non-draft states, the edit UI is hidden.
- **Branch isolation**: Edits to a landing page body in one branch do not affect other branches or the published version until the branch is published.

## Success Criteria

1. Users can browse any level of the content hierarchy (section, category, subcategory) without needing to select an individual content item first
2. Users navigating from the header to a section see a complete overview of categories within 1 second of navigation
3. Users can navigate the full depth of the tree (section > category > subcategory > content) and back up using breadcrumbs without using the browser back button
4. Content discovery improves: users can scan all items in a category or subcategory from a single overview page
5. The navigation experience is consistent — every clickable node in the hierarchy leads to a meaningful page
6. All landing pages work correctly in both published and branch mode

## Key Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| Section | Top-level grouping | Name (Brands/Products/Experiences), categories, overview body |
| Section Page | Branch-scoped overview body for a section | Section key, body, branch ID, version metadata |
| Category | Admin-created grouping within a section (global) | Name, section, display order, content count |
| Category Page | Branch-scoped overview body for a category | Category ID, body, branch ID, version metadata |
| Subcategory | Contributor-created grouping within a category (branch-scoped) | Name, category, display order, content count, overview body |
| Content Item | Individual piece of documentation | Title, slug, description, content type, author, tags |

## Scope & Boundaries

### In Scope
- Section, category, and subcategory landing pages in the Library
- Clickable breadcrumb navigation at all levels
- Sidebar click behavior change (expand + navigate)
- Landing pages in both published and branch mode
- Empty states for all levels

### Out of Scope
- Search or filtering within landing pages (existing search covers this)
- Section-level management or creation (sections are a fixed enum)
- Analytics or tracking of landing page usage
- Custom hero images for landing pages

## Assumptions

- The three sections (Brands, Products, Experiences) remain a fixed set and do not need a "sections overview" page above the section level
- Content counts at the category level include all content in subcategories plus loose content
- Description excerpts on content listings use the existing `description` field from `ContentSummary`, truncated client-side
- Landing pages integrate within the existing Library page layout (sidebar + main content area, right sidebar hidden) rather than as separate routes
- Editable overview bodies for sections, categories, and subcategories will likely require data model changes (new fields or tables) and corresponding backend endpoints — the assumption that no new backend work is needed is **no longer valid**
- The editing workflow for landing page bodies follows the same branch-based model as content items
- Content counts on category cards use the existing `useCategories()` hook which derives counts client-side from published content. For the initial implementation, this is sufficient. If accuracy at scale becomes a concern, a server-side count endpoint can be added later.

## Clarifications

### Session 2026-02-20
- Q: What should `/library` with no section parameter display? → A: Default to the first section's landing page (Brands) — no separate "all sections" overview page.
- Q: Should the right sidebar appear on landing pages? → A: Hide right sidebar. Landing pages have editable content bodies (rich text overviews) with child cards displayed below the content body — not just card grids.
- Q: How should section overview bodies be stored (sections have no DB row)? → A: New `section_pages` table with one row per section, storing the overview body, versioned via branches.
- Q: Should header nav dropdown category clicks navigate to category landing pages? → A: Yes — clicking a category in the header dropdown navigates to the category landing page, consistent with sidebar behavior.
- Q: Who can edit landing page bodies, and how? → A: Same branch-gated flow as content. Admins can edit section and category landing pages; contributors+ can edit subcategory landing pages (matches entity ownership patterns).

### Session 2026-02-20 (continued)
- Q: How should category overview bodies be versioned given categories are global? → A: Separate `category_pages` table storing branch-scoped overview bodies (one row per category per branch), keeping the category entity global.
- Q: Should landing page body edits appear in the review diff view? → A: Yes — landing page body edits appear in the review diff view alongside content item diffs. Reviewers see all branch changes.
- Q: What should an empty landing page body look like? → A: Editors see an "Add overview" prompt that enters edit mode on click; viewers see no body area — child cards render directly at top.
- Q: How should subcategories and content items appear on the category landing page? → A: Uniform card grid — subcategory cards (name + count) and content item cards (title + excerpt + type) side by side.
- Q: Should editing landing page bodies use the full inline editor or a lighter experience? → A: Same full inline editor (EditModeHeader, auto-save, undo/redo) — identical to content editing.

## Dependencies

- Existing persistent categories system (Feature 011)
- Existing subcategories system (Feature 011)
- Existing `ContentBreadcrumb` component (recently added)
- Existing sidebar tree structure in `LibrarySidebar`
- Existing data hooks for categories, subcategories, and content
