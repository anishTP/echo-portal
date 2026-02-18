# Data Model: 011-sidebar-content-hierarchy

**Date**: 2026-02-18

## Entity: Subcategory (NEW)

| Field | Type | Constraints | Description |
| ----- | ---- | ----------- | ----------- |
| id | UUID | PK, default gen_random_uuid() | Primary key |
| name | TEXT | NOT NULL | Subcategory display name |
| categoryId | UUID | NOT NULL, FK → categories.id ON DELETE CASCADE | Parent category |
| displayOrder | INTEGER | NOT NULL, DEFAULT 0 | Sort position within parent category (shared with loose content) |
| createdBy | UUID | NOT NULL, FK → users.id | Creator for audit trail |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updatedAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last modification timestamp |

**Indexes**:
- `subcategories_category_name_uniq` — UNIQUE on (category_id, name)
- `subcategories_category_id_idx` — INDEX on (category_id)
- `subcategories_display_order_idx` — INDEX on (category_id, display_order)

**Relations**:
- Belongs to: Category (many-to-one via categoryId)
- Contains: Content pieces (one-to-many via contents.subcategoryId)
- Cascade: Deleting a category cascades to its subcategories (ON DELETE CASCADE)

## Entity: Content (MODIFIED)

**New columns added**:

| Field | Type | Constraints | Description |
| ----- | ---- | ----------- | ----------- |
| subcategoryId | UUID | NULLABLE, FK → subcategories.id ON DELETE SET NULL | Optional subcategory assignment |
| categoryId | UUID | NULLABLE, FK → categories.id ON DELETE SET NULL | Required category assignment (nullable for migration safety) |

**Deprecated column**:
- `category` (TEXT) — retained for rollback safety, no longer written to by application code

**New indexes**:
- `contents_subcategory_id_idx` — INDEX on (subcategory_id)
- `contents_category_id_idx` — INDEX on (category_id)

**ON DELETE behavior**:
- Deleting a subcategory sets `subcategoryId` to NULL on its content (SET NULL at DB level). However, the application API performs cascade-delete of content BEFORE deleting the subcategory (per spec requirement).
- Deleting a category sets `categoryId` to NULL (SET NULL at DB level). Application handles cascade through subcategories.

## Entity: Category (UNCHANGED)

No schema changes. Existing table structure preserved:
- id, name, section, displayOrder, createdBy, createdAt, updatedAt
- Unique on (section, name)

## Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  categories │     │  subcategories   │     │   contents   │
├─────────────┤     ├──────────────────┤     ├──────────────┤
│ id (PK)     │◄─┐  │ id (PK)          │◄─┐  │ id (PK)      │
│ name        │  │  │ name             │  │  │ title        │
│ section     │  │  │ categoryId (FK)──┘  │  │ categoryId ──┘
│ displayOrder│  │  │ displayOrder     │  │  │ subcategoryId─┘
│ createdBy   │  │  │ createdBy        │  │  │ category (dep)│
│ ...         │  │  │ ...              │  │  │ section      │
└─────────────┘  │  └──────────────────┘  │  │ ...          │
                 │                        │  └──────────────┘
                 │    1:N                  │    1:N (optional)
                 └────────────────────────┘
```

## Display Order Model

Within a category, subcategories and loose content (content without subcategoryId) share a single interleaved display order:

```
Category: "Vehicles" (expanded)
  ├── [displayOrder=0] Subcategory: "V1"        ← subcategories.displayOrder
  │     ├── Content: "Case Study"               ← contents within subcategory (own displayOrder)
  │     └── Content: "Branding"
  ├── [displayOrder=1] Content: "Overview Doc"  ← loose content, contents.displayOrder
  ├── [displayOrder=2] Subcategory: "V2"        ← subcategories.displayOrder
  │     └── Content: "UI Kit"
  └── [displayOrder=3] Content: "FAQ"           ← loose content
```

**Reorder API** accepts an ordered array of `{type: 'subcategory'|'content', id: uuid}` and assigns sequential displayOrder values starting from 0.

## Migration Data Flow

```
BEFORE (current):
  contents.category = "V1" (free text)
  contents.section = "brand"
  categories = [{name: "Vehicles", section: "brand", displayOrder: 0}]

AFTER (migrated):
  subcategories = [{name: "V1", categoryId: <first-cat-in-brand>, displayOrder: 0}]
  contents.subcategoryId = <subcategory-V1-id>
  contents.categoryId = <first-cat-in-brand>
  contents.category = "V1" (retained, deprecated)
```
