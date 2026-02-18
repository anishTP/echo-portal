# Research: 011-sidebar-content-hierarchy

**Date**: 2026-02-18

## Decision 1: Drag-and-Drop Library

**Decision**: Use `@dnd-kit/core` + `@dnd-kit/sortable`

**Rationale**: The project has no existing DnD library. @dnd-kit is the modern React DnD solution, supports sortable lists, cross-container drag, and works well with Radix UI. It's tree-shakable and has React 19 support.

**Alternatives considered**:
- `react-beautiful-dnd`: Deprecated by Atlassian, no React 19 support
- `react-dnd`: Lower-level, more boilerplate, backend-agnostic but harder to implement sortable lists
- Custom drag implementation: Too much effort for the sortable + cross-container requirements

## Decision 2: Interleaved Display Order Model

**Decision**: Subcategories and loose content within a category share a single `displayOrder` integer sequence at the category level. A unified ordering table/approach is needed since two different entity types (subcategories and contents) share the same ordering space.

**Rationale**: The spec clarifies that subcategories and loose content are interleaved (not grouped). This requires a unified ordering approach. Two strategies were evaluated:

**Approach chosen**: Store `displayOrder` on both the `subcategories` table and the `contents` table (for loose content). The sidebar fetches both and merges them into a single sorted list by `displayOrder`. When reordering, the API accepts an ordered list of `{type, id}` pairs and assigns sequential `displayOrder` values.

**Alternative rejected**: A separate `category_item_order` junction table — adds complexity without clear benefit since displayOrder can live directly on the entities.

## Decision 3: Subcategory Schema Placement

**Decision**: New `subcategories` table with `categoryId` FK, alongside a `subcategoryId` nullable FK added to `contents` and a `categoryId` nullable FK added to `contents`.

**Rationale**: Follows the existing Drizzle schema pattern (separate file per entity). The `contents.categoryId` FK replaces the free-text `contents.category` for category assignment. The old `category` text column is retained but deprecated.

## Decision 4: Migration Strategy

**Decision**: Single SQL migration file (`0011_add_subcategories.sql`) that:
1. Creates `subcategories` table
2. Adds `subcategory_id` and `category_id` columns to `contents`
3. Runs data migration in a transaction

**Rationale**: Follows existing migration pattern (raw SQL files, numbered). Data migration within the same file ensures atomicity. The migration assigns content to the first category by displayOrder in its section and creates subcategories from the free-text category values.

## Decision 5: Sidebar State Management

**Decision**: Use React `useState` in the sidebar component for expand/collapse state (a `Set<string>` of expanded node IDs). No Zustand store needed.

**Rationale**: The spec requires in-memory persistence only (resets on page reload). The sidebar already receives all data via props from Library.tsx. A local `useState` is the simplest approach that meets the requirement. The existing Zustand stores (UIStore, ContentStore) don't manage sidebar tree state.

## Decision 6: Audit Logging Pattern

**Decision**: Use the existing `AuditLogger` class from `backend/src/services/audit/logger.ts` for subcategory operations.

**Rationale**: The project already has a comprehensive audit logging system with `auditLogger.log()` that writes to the partitioned `audit_logs` table. Subcategory events use `resourceType: 'subcategory'` with actions like `subcategory.created`, `subcategory.renamed`, `subcategory.deleted`, `subcategory.reordered`.

## Decision 7: Content API Changes

**Decision**: Add `subcategoryId` (optional) and `categoryId` (required for new hierarchy) to the content creation and update schemas. The existing `category` text field is no longer written to by the API.

**Rationale**: The spec requires content to belong to a category and optionally a subcategory. Making `categoryId` required on creation enforces the constraint that no content exists outside a category. Existing content without a categoryId is backfilled during migration.
