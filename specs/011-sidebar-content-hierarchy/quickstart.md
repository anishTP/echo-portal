# Quickstart: 011-sidebar-content-hierarchy

## Prerequisites

- Node.js 20 LTS
- PostgreSQL running locally
- pnpm installed

## Setup

```bash
# Checkout the feature branch
git checkout 011-sidebar-content-hierarchy

# Install dependencies (includes new @dnd-kit packages)
cd frontend && pnpm install && cd ..
cd backend && pnpm install && cd ..

# Run the database migration
cd backend
pnpm drizzle-kit push
# Or apply the SQL migration directly:
# psql $DATABASE_URL < src/db/migrations/0011_add_subcategories.sql
```

## Verify the Migration

```bash
# Check subcategories table exists
psql $DATABASE_URL -c "SELECT count(*) FROM subcategories;"

# Check contents have new columns
psql $DATABASE_URL -c "SELECT subcategory_id, category_id FROM contents LIMIT 5;"
```

## Run Tests

```bash
# Backend tests
cd backend && pnpm test

# Frontend tests
cd frontend && pnpm test

# E2E tests (requires running app)
cd frontend && pnpm test:e2e
```

## Development Workflow

### Phase 1: Database & Schema
1. Create `backend/src/db/schema/subcategories.ts`
2. Modify `backend/src/db/schema/contents.ts` — add subcategoryId, categoryId columns
3. Export from `backend/src/db/schema/index.ts`
4. Write migration `backend/src/db/migrations/0011_add_subcategories.sql`
5. Run migration and verify

### Phase 2: Backend API
1. Create `backend/src/api/routes/subcategories.ts` with all CRUD endpoints
2. Mount in `backend/src/api/index.ts`
3. Update content create/update schemas to accept subcategoryId/categoryId
4. Add audit logging for subcategory operations
5. Create `frontend/src/services/subcategory-api.ts`

### Phase 3: Frontend Sidebar
1. Install `@dnd-kit/core` and `@dnd-kit/sortable` in frontend
2. Rewrite `LibrarySidebar.tsx`:
   - Remove: search, branch banner, action buttons, filter pills, type badges
   - Build: three-level collapsible tree with interleaved ordering
3. Add drag-and-drop for reordering and content reassignment
4. Update context menus for subcategory management
5. Update `Library.tsx` to fetch and pass subcategory data

### Phase 4: Testing
1. Backend integration tests for subcategory API
2. Frontend component tests for sidebar tree
3. Migration verification tests

## Key Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `backend/src/db/schema/subcategories.ts` | NEW | Subcategories Drizzle schema |
| `backend/src/db/schema/contents.ts` | MODIFY | Add subcategoryId, categoryId columns |
| `backend/src/db/schema/index.ts` | MODIFY | Export subcategories schema |
| `backend/src/db/migrations/0011_add_subcategories.sql` | NEW | Migration with data backfill |
| `backend/src/api/routes/subcategories.ts` | NEW | Subcategory CRUD endpoints |
| `backend/src/api/index.ts` | MODIFY | Mount subcategory routes |
| `backend/src/api/routes/contents.ts` | MODIFY | Accept subcategoryId/categoryId |
| `frontend/src/services/subcategory-api.ts` | NEW | Subcategory API client |
| `frontend/src/components/library/LibrarySidebar.tsx` | REWRITE | Three-level tree sidebar |
| `frontend/src/pages/Library.tsx` | MODIFY | Pass subcategory data to sidebar |
| `shared/types/content.ts` | MODIFY | Add subcategoryId, categoryId to ContentSummary |
| `backend/tests/integration/subcategories.test.ts` | NEW | API integration tests |
| `frontend/tests/unit/sidebar-tree.test.tsx` | NEW | Sidebar component tests |
