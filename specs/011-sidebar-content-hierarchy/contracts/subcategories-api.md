# API Contract: Subcategories

**Base path**: `/api/v1/subcategories`

---

## GET /api/v1/subcategories

List subcategories for a category.

**Auth**: Optional (public for published content)
**Query params**:
- `categoryId` (uuid, required) — Filter by parent category

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "V1",
      "categoryId": "uuid",
      "displayOrder": 0,
      "createdBy": "uuid",
      "createdAt": "2026-02-18T00:00:00Z",
      "updatedAt": "2026-02-18T00:00:00Z"
    }
  ]
}
```

**Response 400**: Invalid categoryId format

---

## POST /api/v1/subcategories

Create a new subcategory.

**Auth**: Required — contributor or administrator
**Guard**: Draft branch only (must pass branchId, branch must be in draft state)

**Request body**:
```json
{
  "name": "V3",
  "categoryId": "uuid",
  "branchId": "uuid"
}
```

**Validation**:
- `name`: string, 1-200 characters, trimmed
- `categoryId`: valid uuid, must reference existing category
- `branchId`: valid uuid, must reference draft branch user has access to

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "name": "V3",
    "categoryId": "uuid",
    "displayOrder": 0,
    "createdBy": "uuid",
    "createdAt": "2026-02-18T00:00:00Z",
    "updatedAt": "2026-02-18T00:00:00Z"
  }
}
```

**Response 401**: Not authenticated
**Response 403**: Insufficient role (viewer) or not draft branch
**Response 409**: Duplicate name within category (`{ error: { code: "DUPLICATE", message: "..." } }`)

---

## PATCH /api/v1/subcategories/:id

Rename a subcategory.

**Auth**: Required — contributor or administrator
**Guard**: Draft branch only

**Path params**:
- `id` (uuid) — Subcategory ID

**Request body**:
```json
{
  "name": "V3 Updated",
  "branchId": "uuid"
}
```

**Validation**:
- `name`: string, 1-200 characters, trimmed
- `branchId`: valid uuid, must reference draft branch

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "V3 Updated",
    "categoryId": "uuid",
    "displayOrder": 0,
    "createdBy": "uuid",
    "createdAt": "2026-02-18T00:00:00Z",
    "updatedAt": "2026-02-18T00:00:00Z"
  }
}
```

**Response 404**: Subcategory not found
**Response 409**: Duplicate name within category

---

## DELETE /api/v1/subcategories/:id

Delete a subcategory and cascade-delete its content pieces.

**Auth**: Required — contributor or administrator
**Guard**: Draft branch only

**Path params**:
- `id` (uuid) — Subcategory ID

**Query params**:
- `branchId` (uuid, required) — Must reference draft branch

**Behavior**: Deletes the subcategory and all content pieces assigned to it within a transaction. Returns the count of deleted content pieces in the response.

**Response 200**:
```json
{
  "data": {
    "deletedSubcategory": "uuid",
    "deletedContentCount": 3
  }
}
```

**Response 404**: Subcategory not found

---

## PUT /api/v1/subcategories/reorder

Reorder subcategories and loose content within a category.

**Auth**: Required — contributor or administrator
**Guard**: Draft branch only

**Request body**:
```json
{
  "categoryId": "uuid",
  "branchId": "uuid",
  "order": [
    { "type": "subcategory", "id": "uuid" },
    { "type": "content", "id": "uuid" },
    { "type": "subcategory", "id": "uuid" },
    { "type": "content", "id": "uuid" }
  ]
}
```

**Validation**:
- `categoryId`: valid uuid
- `branchId`: valid uuid, draft branch
- `order`: array of `{type: 'subcategory'|'content', id: uuid}`, all IDs must belong to the specified category

**Behavior**: Assigns sequential `displayOrder` values (0, 1, 2, ...) to each item in the order array. Updates both `subcategories.display_order` and `contents.display_order` in a single transaction.

**Response 200**:
```json
{
  "data": { "updated": 4 }
}
```

---

## Content Endpoints (MODIFIED)

### POST /api/v1/contents — Changes

**New fields in request body**:
- `categoryId` (uuid, required) — Parent category
- `subcategoryId` (uuid, optional) — Parent subcategory (null = loose content under category)

**Deprecated field**:
- `category` (string) — No longer accepted; returns 400 if provided without categoryId

### PUT /api/v1/contents/:contentId — Changes

**New fields in request body** (all optional):
- `categoryId` (uuid) — Change parent category
- `subcategoryId` (uuid | null) — Change or remove subcategory assignment

### PATCH /api/v1/contents/:contentId/move — NEW

Move a content piece to a different subcategory (drag-and-drop reassignment).

**Auth**: Required — contributor or administrator
**Guard**: Draft branch only

**Request body**:
```json
{
  "branchId": "uuid",
  "subcategoryId": "uuid | null",
  "displayOrder": 2
}
```

**Response 200**: Updated content summary
