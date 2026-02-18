# Feature Specification: Left Sidebar Redesign — Three-Level Content Hierarchy

**Feature Branch**: `011-sidebar-content-hierarchy`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "Redesign the left sidebar (LibrarySidebar) to introduce a three-level hierarchy: Category → Subcategory → Content Piece, replacing the current two-level flat structure. Remove search bar, branch status indicator, branch action buttons, content type filter pills, and content type badges. Add a new subcategories data layer between categories and content pieces."

## Clarifications

### Session 2026-02-18

- Q: When a subcategory is deleted that still contains content pieces, what should happen to those content pieces? → A: Cascade-delete the content pieces along with the subcategory, with a confirmation warning shown to the user.
- Q: Is a subcategory association required for all content pieces, or can content exist without one? → A: Optional — content can exist without a subcategory. Unassigned content appears directly under its parent category (not in a separate section).
- Q: Should sidebar expand/collapse states persist across page navigation? → A: Persist in-memory for the session — tree state resets only on full page reload or browser close.
- Q: What should happen to the old free-text category column on the contents table after migration? → A: Keep but mark deprecated — stop writing to it, retain data for rollback safety, remove in a future migration.
- Q: How should the migration determine the parent category for each subcategory created from a free-text category value? → A: Assign to the first category (by display order) in the content's section. Admins can reorganize subcategories across categories after migration.
- Q: Can subcategories be moved between parent categories? → A: No — subcategories cannot be reparented. To move a subcategory to a different category, users must delete and recreate it under the new category.
- Q: Can content pieces be reassigned to a different subcategory? → A: Yes, via drag-and-drop only — users drag a content piece onto a different subcategory to reassign it.
- Q: How should subcategory reordering work in the sidebar? → A: Drag-and-drop — drag subcategories within their parent category to reorder.
- Q: What should happen when a subcategory inline rename fails validation? → A: Revert to original name silently on blur or invalid submit. User must retry rename from context menu.
- Q: How should the "Add Subcategory" creation flow work? → A: Inline at top — a new editable text field appears at the top of the category's subcategory list. Enter saves, Escape or blur cancels.
- Q: Should drag-and-drop content reassignment be constrained to the same section? → A: Same section only — content can only be dragged between subcategories within the currently visible section.
- Q: Where should the "Add Content" action appear in the new three-level hierarchy? → A: Both subcategory and "Unsorted" — right-click a subcategory to add content assigned to it, or add from the "Unsorted" section to create unassigned content.
- Q: How should the "Unsorted" section behave in the sidebar? → A: There is no separate "Unsorted" section. Content without a subcategory appears directly under its parent category (alongside subcategories), collapsing when the category is collapsed. There is no explicit "Unsorted" subcategory. All content must belong to a category — no content exists outside a category.
- Q: When a category contains both subcategories and loose content, what is the display order? → A: Interleaved — subcategories and loose content share the same display order space. Users can drag-and-drop to reorder them freely. New items are added to the top by default. Order persists until changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Content via Three-Level Hierarchy (Priority: P1)

A user opens the sidebar and sees a clean tree navigation organized as Categories → Subcategories → Content Pieces. They click a category (e.g., "Vehicles") to expand it and see its subcategories (e.g., "V1", "V2", "VX2"). They click a subcategory to expand it and see its content pieces (e.g., "Case Study", "Branding", "UI Kit"). Clicking a content piece navigates to that content in the main area, and the selected item is visually highlighted.

**Why this priority**: This is the core user experience change. Without the three-level hierarchy rendering correctly, no other feature in this redesign delivers value. Every user interaction depends on this navigation model.

**Independent Test**: Can be fully tested by loading the sidebar with sample data spanning multiple categories, subcategories, and content pieces. Verifies that expand/collapse works at both levels and content selection navigates correctly.

**Acceptance Scenarios**:

1. **Given** a sidebar with categories containing subcategories and content, **When** the user clicks a category row, **Then** it expands to show its subcategories with a chevron rotation animation
2. **Given** an expanded category, **When** the user clicks a subcategory, **Then** it expands to show its content pieces
3. **Given** an expanded subcategory, **When** the user clicks a content piece, **Then** the content loads in the main area and the item receives a highlighted background
4. **Given** an expanded category or subcategory, **When** the user clicks it again, **Then** it collapses and hides its children
5. **Given** the sidebar loads, **When** there is a currently active content piece, **Then** its parent subcategory and category are auto-expanded and the item is highlighted

---

### User Story 2 - Simplified Sidebar Chrome (Priority: P1)

A user sees a clean, minimal sidebar without the search bar, branch status banner, branch action buttons, content type filter pills, or content type badges. The sidebar presents only the tree navigation, reducing visual clutter and focusing attention on the content hierarchy.

**Why this priority**: Removing these elements is a prerequisite for the new visual design. The old chrome conflicts with the clean tree layout and must be removed for the redesign to function as intended.

**Independent Test**: Can be tested by verifying the absence of removed elements (search input, branch banner, filter pills, type badges) while confirming the sidebar still renders its navigation tree.

**Acceptance Scenarios**:

1. **Given** the sidebar renders, **When** the user inspects it, **Then** there is no search input or keyboard shortcut badge
2. **Given** the user is viewing a draft branch, **When** the sidebar renders, **Then** there is no branch name banner, no lifecycle badge, and no branch action buttons (Submit for Review, Review Changes, View Feedback)
3. **Given** content items are displayed, **When** the user views them, **Then** there are no content type filter pills (All/Guidelines/Assets/Opinions) and no colored type badges (G/A/O)

---

### User Story 3 - Manage Subcategories in Draft Branches (Priority: P2)

A contributor working in a draft branch can create, rename, reorder, and delete subcategories within a category. They right-click a category to add a new subcategory, or right-click an existing subcategory to rename, reorder, or delete it. These actions are only available in draft branch mode.

**Why this priority**: Subcategory management is the primary new capability this feature introduces. It depends on the three-level hierarchy (P1) being in place but delivers independent value by letting contributors organize content at a finer granularity.

**Independent Test**: Can be tested by entering a draft branch, right-clicking a category to create a subcategory, then verifying it appears in the tree. Rename, reorder, and delete can each be tested independently via context menu actions.

**Acceptance Scenarios**:

1. **Given** a contributor is in a draft branch, **When** they right-click a category, **Then** the context menu includes "Add Subcategory"
2. **Given** a contributor selects "Add Subcategory" from a category's context menu, **When** the category expands (if collapsed) and an inline text field appears at the top of the subcategory list, **Then** typing "V3" and pressing Enter creates the subcategory, which appears indented under "Vehicles" in the correct display order
3. **Given** a contributor right-clicks an existing subcategory, **When** they select "Rename", **Then** an inline text input appears pre-filled with the current name. Pressing Enter with a valid name saves it; pressing Escape, blurring, or submitting an invalid name (empty or duplicate) silently reverts to the original name
4. **Given** a contributor right-clicks a subcategory, **When** they select "Delete", **Then** the subcategory and its content pieces are removed from the tree (with confirmation)
5. **Given** the user is viewing the published/main branch, **When** they right-click any item, **Then** no mutation actions (create, rename, delete) appear in the context menu
6. **Given** a contributor is in a draft branch, **When** they drag a content piece from one subcategory onto another subcategory or onto the parent category (to unassign from subcategory), **Then** the content piece is reassigned and the sidebar tree updates immediately

---

### User Story 4 - Migrate Existing Content to Subcategories (Priority: P2)

When this feature is deployed, all existing content pieces that have a free-text category value are automatically migrated. The system creates corresponding subcategory records and links each content piece to its matching subcategory, preserving the existing organizational structure without manual intervention.

**Why this priority**: Without migration, existing content would be orphaned or invisible in the new three-level hierarchy. This is essential for backward compatibility but is a one-time operation, not an ongoing user interaction.

**Independent Test**: Can be tested by running the migration against a database with existing content that has free-text category values and verifying that subcategory records are created and content pieces are correctly linked.

**Acceptance Scenarios**:

1. **Given** existing content items with free-text category values (e.g., category = "V1"), **When** the migration runs, **Then** a subcategory named "V1" is created under the first category (by display order) in the content's section, and the content item is linked to it
2. **Given** multiple content items sharing the same free-text category within a section, **When** the migration runs, **Then** only one subcategory record is created and all matching items link to it
3. **Given** a content item with no category value, **When** the migration runs, **Then** the item remains unassigned (no subcategory) and appears directly under the first category (by display order) in its section
4. **Given** the migration has completed, **When** the sidebar loads, **Then** the three-level hierarchy displays the same organizational structure as before but with subcategories as the intermediate level

---

### User Story 5 - Admin Category Management (Priority: P3)

Administrators retain full control over top-level categories: they can create, rename, reorder, and delete categories via right-click context menus. This existing capability continues to work within the new three-level hierarchy, but only in draft branch mode.

**Why this priority**: This is existing functionality that must be preserved. It has lower priority because it already works and only needs to be maintained through the redesign, not built from scratch.

**Independent Test**: Can be tested by logging in as an admin in a draft branch, right-clicking a category, and verifying create/rename/reorder/delete actions still function correctly.

**Acceptance Scenarios**:

1. **Given** an admin is in a draft branch, **When** they right-click a category, **Then** the context menu includes "Rename Category", "Delete Category", and "Reorder"
2. **Given** a non-admin contributor is in a draft branch, **When** they right-click a category, **Then** category management actions (rename, delete) are not available — only "Add Subcategory" is shown
3. **Given** the user is on the published branch, **When** they right-click a category, **Then** no mutation actions appear regardless of role

---

### Edge Cases

- What happens when a subcategory is deleted that still contains content pieces? The system cascade-deletes all child content pieces along with the subcategory, after displaying a confirmation warning that lists the number of content pieces that will be permanently removed.
- What happens when two contributors create subcategories with the same name under the same category concurrently? The unique constraint (categoryId + name) prevents duplicates; the second request receives a conflict error.
- What happens when a category is deleted that contains subcategories? All child subcategories and their content associations are cascaded.
- What happens when the sidebar has no categories at all? An empty state message is shown.
- What happens when a category exists but has no subcategories? The category is still shown but expands to an empty state or a prompt to add a subcategory (in draft branch mode).
- What happens when a subcategory exists but has no content pieces? The subcategory is still shown but expands to show no children (or a subtle "empty" indicator in draft mode).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display sidebar content in a three-level hierarchy: Category → Subcategory → Content Piece
- **FR-002**: Categories MUST be collapsible, showing a folder icon and chevron toggle that rotates on expand/collapse
- **FR-003**: Subcategories MUST be collapsible, shown indented under their parent category with a right-arrow chevron that rotates on expand
- **FR-004**: Content pieces MUST be shown indented under their parent subcategory as plain text labels without icons
- **FR-005**: The currently selected content piece MUST display a subtle highlighted background with slightly bolder font weight
- **FR-006**: System MUST remove the sidebar search bar (the ⌘K input)
- **FR-007**: System MUST remove the branch status indicator banner (branch name + lifecycle badge)
- **FR-008**: System MUST remove branch action buttons (Submit for Review, Review Changes, View Feedback)
- **FR-009**: System MUST remove content type filter pills (All / Guidelines / Assets / Opinions)
- **FR-010**: System MUST remove content type badges on individual items (G/A/O colored letters)
- **FR-011**: System MUST support a new data entity "Subcategory" that belongs to a Category and contains Content Pieces
- **FR-012**: Each subcategory MUST have a unique name within its parent category
- **FR-013**: Contributors and administrators MUST be able to create subcategories within a category (draft branch only). Creation uses an inline editable text field that appears at the top of the category's subcategory list. The category auto-expands if collapsed. Pressing Enter saves, pressing Escape or blurring cancels. Invalid input (empty or duplicate name) cancels silently
- **FR-014**: Contributors and administrators MUST be able to rename subcategories via inline text input (draft branch only). On invalid input (empty name, duplicate name within parent category) or blur, the name silently reverts to the original value
- **FR-015**: Contributors and administrators MUST be able to delete subcategories (draft branch only)
- **FR-016**: Contributors and administrators MUST be able to reorder subcategories and loose content within a category via drag-and-drop (draft branch only). Subcategories and loose content share one interleaved order. Subcategories cannot be dragged to a different category
- **FR-017**: Only administrators MUST be able to create, rename, reorder, and delete categories (same as current behavior)
- **FR-018**: All sidebar mutations (create, rename, reorder, delete for categories, subcategories, and content) MUST be blocked when viewing the published/main branch
- **FR-019**: Context menus for mutation actions MUST only appear when the user is in draft branch mode
- **FR-020**: System MUST auto-expand the parent category and subcategory of the currently active content piece on sidebar load
- **FR-026**: Sidebar expand/collapse states MUST persist in-memory for the duration of the session. Tree state resets only on full page reload or browser close. Previously expanded nodes remain open when navigating between content pieces
- **FR-021**: Existing content with free-text category values MUST be migrated to the new subcategory data model, creating subcategory records and linking content pieces accordingly. The old free-text `category` column MUST be retained (deprecated) for rollback safety but no longer written to. It will be removed in a future migration
- **FR-022**: The sidebar MUST maintain its current width (~280px) and sticky left-column positioning
- **FR-023**: Content pieces MUST accept an optional subcategory association, replacing the current free-text category string as the primary organizational link. Content without a subcategory is displayed directly under its parent category, alongside any subcategories. All content MUST belong to a category — no content exists outside a category
- **FR-024**: Within a category, subcategories and loose content pieces (those without a subcategory) share a single interleaved display order. Users can drag-and-drop to reorder them freely. New items (both subcategories and loose content) are added to the top by default. The order persists until changed by the user
- **FR-025**: System MUST provide endpoints to list, create, update, delete, and reorder subcategories
- **FR-027**: Contributors and administrators MUST be able to reassign content pieces between subcategories, or unassign from a subcategory (by dropping onto the parent category), via drag-and-drop in the sidebar tree (draft branch only). Drag-and-drop is constrained to the currently visible section — cross-section reassignment is not supported
- **FR-028**: Subcategories MUST NOT be movable between parent categories — the parent category is immutable after creation
- **FR-029**: "Add Content" MUST be available from two locations (draft branch only): (a) right-clicking a subcategory creates content assigned to that subcategory, and (b) right-clicking a category creates content directly under that category with no subcategory assignment

### Key Entities

- **Category**: A top-level organizational group within a section (brand/product/experience). Has a name, display order, and section. Managed by administrators only. Contains zero or more subcategories.
- **Subcategory**: A second-level organizational group within a category. Has a name, display order, and parent category reference. Unique by name within its parent category. Managed by contributors and administrators. Cannot be moved between categories — parent category is immutable after creation. Contains zero or more content pieces.
- **Content Piece**: A leaf-level item (guideline, asset, or opinion) that MUST belong to a category and optionally belongs to a subcategory. Displayed as plain text in the sidebar tree. Content without a subcategory appears directly under its parent category, alongside subcategories, and collapses when the category is collapsed. The existing content entity gains a required category reference and an optional subcategory association.

### Actors and Permissions *(mandatory per Constitution VIII)*

| Role/Actor        | Permissions                                                                                            | Authentication Required |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| **Viewer**        | Browse the three-level hierarchy, expand/collapse nodes, view published content                        | No                      |
| **Contributor**   | All viewer permissions + create/rename/reorder/delete subcategories and content pieces (draft branches) | Yes                     |
| **Reviewer**      | Same as contributor for sidebar navigation purposes                                                    | Yes                     |
| **Administrator** | All contributor permissions + create/rename/reorder/delete categories (draft branches)                 | Yes                     |

### Lifecycle States and Transitions *(mandatory per Constitution VIII)*

This feature does not introduce new lifecycle states. The existing branch lifecycle (Draft → Review → Approved → Published → Archived) governs when sidebar mutations are permitted:

**States** (unchanged):
- **Draft**: All sidebar mutations allowed (per role permissions)
- **Review**: Sidebar is read-only (browse and expand/collapse only)
- **Approved**: Sidebar is read-only
- **Published**: Sidebar is read-only — this is the primary guard against mutations
- **Archived**: Sidebar is read-only

**Mutation Guard**:
```
Draft branch → Mutations allowed (role-permitting)
Any other state → All mutations blocked
```

### Visibility Boundaries *(mandatory per Constitution VIII)*

| Context                 | Sidebar Content Visible                                                   | Who Can See                                        |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Published branch        | All published categories, subcategories, and content pieces               | Everyone (including anonymous viewers)              |
| Draft branch (own)      | Published content + draft additions/changes in this branch                | Branch owner, collaborators, administrators         |
| Draft branch (team)     | Published content + draft additions/changes visible to team               | Branch owner, collaborators, reviewers, administrators |
| Review/Approved branch  | Published content + branch changes (read-only sidebar)                    | Branch owner, assigned reviewers, administrators    |

### Auditability and Traceability *(mandatory per Constitution VIII)*

**Required Audit Events**:
- Subcategory created (actor, timestamp, subcategory name, parent category)
- Subcategory renamed (actor, timestamp, old name, new name)
- Subcategory deleted (actor, timestamp, subcategory name, number of affected content pieces)
- Subcategory reordered (actor, timestamp, category, new order)
- Content piece moved to subcategory (actor, timestamp, content ID, subcategory)
- Migration executed (system actor, timestamp, number of subcategories created, number of content pieces linked)

**Audit Log Format**: Each log entry MUST include:
- `timestamp`: ISO 8601 format
- `actor`: User ID or "system" for automated migration
- `action`: Action type (created, renamed, deleted, reordered, migrated)
- `resource`: Subcategory ID or content ID
- `metadata`: Additional context (parent category, old/new values, affected counts)

**Retention Policy**: Audit logs follow the existing platform retention policy (same as category and content audit events).

## Assumptions

- The header navigation (Brands / Products / Experiences dropdowns) remains unchanged and continues to control section-level filtering that determines which categories appear in the sidebar.
- The right sidebar (author, details, tags, TOC) is unchanged.
- The main content area is unchanged.
- Global search in the header remains; only sidebar-embedded search is removed.
- Removing the branch status banner and action buttons from the sidebar does not remove them from the application entirely — they may be relocated to the header or another UI surface in a separate feature. For this feature, they are simply removed from the sidebar.
- When a subcategory is deleted, its child content pieces are cascade-deleted along with it. A confirmation warning is shown to the user listing the number of affected content pieces.
- Content pieces with no existing category value will be assigned to the first category (by display order) in their section during migration, with no subcategory assignment. They appear directly under that category.
- The existing `displayOrder` behavior for categories is preserved. Subcategories use the same ordering pattern.
- During migration, subcategories created from free-text category values are assigned to the first category (by display order) within the content's section. Admins can reorganize subcategories across categories after migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from a top-level category to a specific content piece in 3 clicks or fewer (expand category → expand subcategory → click content)
- **SC-002**: The sidebar renders the full three-level hierarchy within 1 second of page load for libraries with up to 500 content pieces
- **SC-003**: 100% of existing content pieces are correctly migrated to the subcategory model with no orphaned items
- **SC-004**: All removed UI elements (search bar, branch banner, filter pills, type badges, action buttons) are no longer present in the sidebar
- **SC-005**: Contributors can create a new subcategory and add content to it within 30 seconds
- **SC-006**: The sidebar visual hierarchy is distinguishable at each level through indentation, iconography, and typography without relying on color badges

### Verification Requirements *(mandatory per Constitution VIII)*

**Acceptance Tests**:
- [ ] All user stories pass acceptance scenarios
- [ ] All functional requirements verified
- [ ] Permission checks validated for each role at each hierarchy level
- [ ] Mutation blocking verified on published/non-draft branches
- [ ] Migration produces correct subcategory linkages for all existing content
- [ ] All audit events logged correctly for subcategory operations

**Test Coverage**:
- Core workflows: 80% minimum (Constitution X)
- Edge cases: All documented edge cases have test coverage
- Integration tests: Subcategory CRUD operations, permission enforcement, migration correctness

**Validation Procedures**:
1. Manual walkthrough of sidebar navigation with sample data spanning 5+ categories, 20+ subcategories, and 50+ content pieces
2. Automated regression test suite passes for all sidebar interactions
3. Role-based access control verified: viewer cannot mutate, contributor can manage subcategories, admin can manage categories
4. Migration dry-run against production-like data confirms zero data loss
5. Visual inspection confirms removed elements are absent and new hierarchy matches reference design

**Sign-off Criteria**:
- [ ] Product owner approves sidebar visual design and interaction model
- [ ] All existing sidebar tests updated or replaced to reflect new structure
- [ ] Migration tested against representative data set
- [ ] No regressions in content viewing or navigation
