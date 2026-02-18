-- Add subcategories table and link contents to categories/subcategories
-- Feature: 011-sidebar-content-hierarchy

BEGIN;

-- 1. Create subcategories table
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subcategories_category_name_uniq ON subcategories (category_id, name);
CREATE INDEX subcategories_category_id_idx ON subcategories (category_id);
CREATE INDEX subcategories_display_order_idx ON subcategories (category_id, display_order);

-- 2. Add new columns to contents table
ALTER TABLE contents ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE contents ADD COLUMN subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE contents ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX contents_category_id_idx ON contents (category_id);
CREATE INDEX contents_subcategory_id_idx ON contents (subcategory_id);

-- 3. Data migration: convert free-text category values into subcategory records
-- For each distinct (section, category) pair in contents, create a subcategory
-- under the first category (by display_order) in that section.

-- 3a. Set category_id for all content to the first persistent category in their section
UPDATE contents c
SET category_id = cat.id
FROM (
  SELECT DISTINCT ON (section) id, section
  FROM categories
  ORDER BY section, display_order ASC
) cat
WHERE c.section = cat.section
  AND c.category_id IS NULL;

-- 3b. Create subcategory records from distinct category text values
INSERT INTO subcategories (name, category_id, display_order, created_by)
SELECT DISTINCT ON (c.category, cat.id)
  c.category,
  cat.id,
  ROW_NUMBER() OVER (PARTITION BY cat.id ORDER BY c.category) - 1,
  cat_record.created_by
FROM contents c
JOIN (
  SELECT DISTINCT ON (section) id, section
  FROM categories
  ORDER BY section, display_order ASC
) cat ON c.section = cat.section
JOIN categories cat_record ON cat_record.id = cat.id
WHERE c.category IS NOT NULL
  AND c.category != '';

-- 3c. Link content to their newly created subcategories
UPDATE contents c
SET subcategory_id = s.id
FROM subcategories s
WHERE c.category = s.name
  AND c.category_id = s.category_id
  AND c.subcategory_id IS NULL;

COMMIT;
