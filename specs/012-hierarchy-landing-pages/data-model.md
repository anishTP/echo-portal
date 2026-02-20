# Data Model: 012 Hierarchy Landing Pages

## New Tables

### `section_pages`

Stores editable overview bodies for sections (Brands, Products, Experiences). One row per section per branch.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| section | content_section (enum) | NOT NULL | 'brand' / 'product' / 'experience' |
| branch_id | uuid | NOT NULL, FK → branches.id | Main branch = published version |
| body | text | NOT NULL, default '' | Markdown content |
| created_by | uuid | NOT NULL, FK → users.id | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Indexes:**
- `UNIQUE (section, branch_id)` — one body per section per branch

**Relationships:**
- `branch_id` → `branches.id` (CASCADE on delete — branch deletion removes its pages)
- `created_by` → `users.id`

---

### `category_pages`

Stores editable overview bodies for categories. Categories remain global; this table holds branch-scoped editorial content.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| category_id | uuid | NOT NULL, FK → categories.id (CASCADE) | |
| branch_id | uuid | NOT NULL, FK → branches.id | Main branch = published version |
| body | text | NOT NULL, default '' | Markdown content |
| created_by | uuid | NOT NULL, FK → users.id | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Indexes:**
- `UNIQUE (category_id, branch_id)` — one body per category per branch

**Relationships:**
- `category_id` → `categories.id` (CASCADE — category deletion removes all its pages)
- `branch_id` → `branches.id` (CASCADE)
- `created_by` → `users.id`

---

## Modified Tables

### `subcategories` — Add `body` column

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| body | text | NOT NULL, default '' | Markdown overview content |

Subcategories are already branch-scoped, so no new table is needed.

---

## Entity Relationships

```
branches (1) ──── (*) section_pages
                        └── section (enum)

branches (1) ──── (*) category_pages
                        └── category_id → categories.id

branches (1) ──── (*) subcategories (existing, add body)
                        └── category_id → categories.id

categories (1) ──── (*) category_pages
categories (1) ──── (*) subcategories
```

## Read Semantics (Fallback Pattern)

When reading a landing page body for a given branch:
1. Query for a row matching the entity + branch_id
2. If not found, query for the row matching the entity + main branch_id (published version)
3. If not found, return empty body (null/empty string)

This means a branch inherits published bodies until explicitly overridden.

## Publish Semantics

When a branch is published:
1. For each `section_pages` row on the branch → upsert into main branch row
2. For each `category_pages` row on the branch → upsert into main branch row
3. For subcategories: the existing publish flow handles subcategory merging; the `body` field comes along automatically

## Comparison Semantics (Review Diffs)

For each landing page type with a branch-specific row:
- Compare branch body against main branch body (or empty string if no published version)
- Generate `FileDiff` entries with `fileType` discriminator
- Include in `BranchComparison.files[]` alongside content diffs
