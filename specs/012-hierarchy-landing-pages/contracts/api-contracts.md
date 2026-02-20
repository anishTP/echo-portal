# API Contracts: 012 Hierarchy Landing Pages

## Shared Types

```typescript
// shared/types/landing-pages.ts

interface SectionPageDTO {
  id: string;
  section: 'brand' | 'product' | 'experience';
  branchId: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoryPageDTO {
  id: string;
  categoryId: string;
  branchId: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// SubcategoryDTO already exists — just gains a `body` field
interface SubcategoryDTO {
  id: string;
  name: string;
  categoryId: string;
  displayOrder: number;
  body: string;        // NEW
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// For comparison/review diffs — extend existing FileDiff
type LandingPageFileType = 'section_page' | 'category_page' | 'subcategory_page';
```

---

## Section Pages

### GET /api/v1/section-pages/:section

Read the section page body. Falls back to published version if no branch override exists.

**Query Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| branchId | uuid | No | If omitted, returns published version |

**Response: 200 OK**
```json
{
  "id": "uuid",
  "section": "brand",
  "branchId": "uuid",
  "body": "# Welcome to Brands\n\nOverview text...",
  "createdBy": "uuid",
  "createdAt": "2026-02-20T00:00:00Z",
  "updatedAt": "2026-02-20T00:00:00Z"
}
```

**Response: 200 OK (no body exists yet)**
```json
{
  "id": null,
  "section": "brand",
  "branchId": null,
  "body": "",
  "createdBy": null,
  "createdAt": null,
  "updatedAt": null
}
```

### PUT /api/v1/section-pages/:section

Create or update the section page body for a branch. Upsert semantics.

**Auth:** requireAuth — administrators only
**Precondition:** Branch must be in `draft` state

**Request Body:**
```json
{
  "branchId": "uuid",
  "body": "# Welcome to Brands\n\nUpdated overview..."
}
```

**Response: 200 OK**
```json
{
  "id": "uuid",
  "section": "brand",
  "branchId": "uuid",
  "body": "# Welcome to Brands\n\nUpdated overview...",
  "createdBy": "uuid",
  "createdAt": "2026-02-20T00:00:00Z",
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

---

## Category Pages

### GET /api/v1/category-pages/:categoryId

Read the category page body. Falls back to published version if no branch override exists.

**Query Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| branchId | uuid | No | If omitted, returns published version |

**Response:** Same shape as section pages but with `categoryId` instead of `section`.

### PUT /api/v1/category-pages/:categoryId

Create or update the category page body for a branch. Upsert semantics.

**Auth:** requireAuth — administrators only
**Precondition:** Branch must be in `draft` state

**Request Body:**
```json
{
  "branchId": "uuid",
  "body": "# Vehicles\n\nEverything about our vehicle brands..."
}
```

**Response:** Same shape as GET with updated fields.

---

## Subcategory Body

No new endpoints. The existing subcategory endpoints are extended:

### GET /api/v1/subcategories?categoryId=xxx

**Response change:** Each `SubcategoryDTO` in the response now includes a `body` field (string, defaults to `""`).

### PATCH /api/v1/subcategories/:id

**Request body extension:**
```json
{
  "name": "SUVs",
  "branchId": "uuid",
  "body": "# SUVs\n\nOur SUV lineup overview..."
}
```

`body` is optional — omitting it leaves the body unchanged.

---

## Content Comparison Extension

### GET /api/v1/branches/:branchId/comparison

**Response change:** `files` array may now include entries with landing page diffs.

**New FileDiff fields:**
```typescript
interface FileDiff {
  // ... existing fields ...
  fileType?: 'content' | 'section_page' | 'category_page' | 'subcategory_page';
  // When fileType is 'section_page': path = "Section: Brands"
  // When fileType is 'category_page': path = "Category: Vehicles"
  // When fileType is 'subcategory_page': path = "Subcategory: SUVs"
}
```

Landing page diffs appear in the same `files[]` array as content diffs. The `fileType` field discriminates them. The `contentId` field is null for landing page diffs; a new `landingPageId` field holds the `section_pages.id` or `category_pages.id`.

---

## Branch Publish Extension

No new API endpoints. The existing publish flow (`POST /api/v1/branches/:branchId/publish`) is extended internally:

1. After content merge, upsert `section_pages` from branch to main
2. After content merge, upsert `category_pages` from branch to main
3. Subcategory bodies are handled by existing subcategory merge logic (body field comes along)
