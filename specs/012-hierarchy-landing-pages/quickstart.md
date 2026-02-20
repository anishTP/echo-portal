# Quickstart: 012 Hierarchy Landing Pages

## Prerequisites

- Node.js 20 LTS, pnpm
- PostgreSQL running locally
- `pnpm install` from repo root

## Getting Started

```bash
# Switch to feature branch
git checkout 012-hierarchy-landing-pages

# Install dependencies
pnpm install

# Generate and run migrations (after schema changes in Phase 1)
cd backend
npm run db:generate
npm run db:push   # or db:migrate for production

# Run backend tests
cd backend && npx vitest run

# Run frontend tests
cd frontend && npx vitest run

# Type check
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

## Implementation Order

1. **Start with T001–T003** (schema + types) — foundation for everything else
2. **T004–T006** (routes) can be done in parallel once schema is in
3. **T007–T008** (comparison + publish) depend on routes existing
4. **T009–T011** (frontend API/hooks/cards) can start as soon as types (T003) are done
5. **T012–T014** (landing page components) depend on T011
6. **T015–T020** (integration) depend on both Phase 1 and Phase 2

## Key Files to Study First

| File | Why |
|------|-----|
| `backend/src/db/schema/categories.ts` | Pattern for table definitions |
| `backend/src/api/routes/subcategories.ts` | Pattern for simple CRUD routes |
| `backend/src/services/review/content-comparison-service.ts` | Must extend for diffs |
| `frontend/src/pages/Library.tsx:1042-1087` | Conditional rendering pattern |
| `frontend/src/hooks/usePublishedContent.ts` | TanStack Query hook patterns |
| `frontend/src/components/library/ContentBreadcrumb.tsx` | Breadcrumb to make clickable |
| `frontend/src/components/library/LibrarySidebar.tsx:367-383` | Click handlers to extend |

## Testing Patterns

**Backend integration tests:** Mock DB with `vi.mock('../../src/db')`, chain pattern for queries. Use cookie auth (`Cookie: echo_session=token`). UUIDs must be valid format.

**Frontend component tests:** Mock `@radix-ui/themes` components, mock `Element.prototype.scrollIntoView`. Use `vi.mock` factories (hoisted, no outer scope refs).

## URL Patterns After Implementation

| Level | URL | Renders |
|-------|-----|---------|
| Default | `/library` | Brands section landing page |
| Section | `/library?section=brands` | SectionLandingPage |
| Category | `/library?section=brands&category=Vehicles` | CategoryLandingPage |
| Subcategory | `/library?section=brands&category=Vehicles&subcategoryId=xxx` | SubcategoryLandingPage |
| Content | `/library/content-slug` | ContentRenderer (unchanged) |
