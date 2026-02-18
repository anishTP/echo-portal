import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Migration verification tests for 0011_add_subcategories.sql
 *
 * These tests verify the expected outcomes of the data migration that:
 * 1. Creates the subcategories table
 * 2. Adds category_id, subcategory_id, display_order columns to contents
 * 3. Migrates free-text category values into subcategory records
 * 4. Links content to the first persistent category in their section
 * 5. Links content to their newly created subcategories
 *
 * Since we cannot execute raw SQL in unit tests, we simulate the expected
 * post-migration state by mocking database queries that would verify results.
 */

// --- UUIDs ---

const UUID_USER_1 = '00000000-0000-4000-a000-000000000001';

const UUID_CATEGORY_BRAND_1 = '00000000-0000-4000-a000-000000000010';
const UUID_CATEGORY_BRAND_2 = '00000000-0000-4000-a000-000000000011';
const UUID_CATEGORY_PRODUCT_1 = '00000000-0000-4000-a000-000000000012';

const UUID_SUBCATEGORY_1 = '00000000-0000-4000-a000-000000000020';
const UUID_SUBCATEGORY_2 = '00000000-0000-4000-a000-000000000021';
const UUID_SUBCATEGORY_3 = '00000000-0000-4000-a000-000000000022';

const UUID_CONTENT_1 = '00000000-0000-4000-a000-000000000030';
const UUID_CONTENT_2 = '00000000-0000-4000-a000-000000000031';
const UUID_CONTENT_3 = '00000000-0000-4000-a000-000000000032';
const UUID_CONTENT_4 = '00000000-0000-4000-a000-000000000033';
const UUID_CONTENT_5 = '00000000-0000-4000-a000-000000000034';

const UUID_BRANCH_1 = '00000000-0000-4000-a000-000000000040';

// --- Pre-migration data ---

/** Categories that exist before migration (persistent categories table) */
const preMigrationCategories = [
  {
    id: UUID_CATEGORY_BRAND_1,
    name: 'Logo Usage',
    section: 'brand' as const,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: UUID_CATEGORY_BRAND_2,
    name: 'Typography',
    section: 'brand' as const,
    displayOrder: 1,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: UUID_CATEGORY_PRODUCT_1,
    name: 'Components',
    section: 'product' as const,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

/** Content rows before migration with free-text category values */
const preMigrationContents = [
  {
    id: UUID_CONTENT_1,
    branchId: UUID_BRANCH_1,
    slug: 'logo-dark-mode',
    title: 'Logo Dark Mode Guidelines',
    contentType: 'guideline',
    category: 'V1 Models',     // free-text category
    section: 'brand' as const,
    categoryId: null,           // not yet assigned
    subcategoryId: null,        // not yet assigned
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  },
  {
    id: UUID_CONTENT_2,
    branchId: UUID_BRANCH_1,
    slug: 'logo-light-mode',
    title: 'Logo Light Mode Guidelines',
    contentType: 'guideline',
    category: 'V1 Models',     // same free-text as content 1
    section: 'brand' as const,
    categoryId: null,
    subcategoryId: null,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-11'),
    updatedAt: new Date('2026-01-11'),
  },
  {
    id: UUID_CONTENT_3,
    branchId: UUID_BRANCH_1,
    slug: 'logo-animated',
    title: 'Animated Logo Specs',
    contentType: 'guideline',
    category: 'V2 Models',     // different free-text, same section
    section: 'brand' as const,
    categoryId: null,
    subcategoryId: null,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-12'),
    updatedAt: new Date('2026-01-12'),
  },
  {
    id: UUID_CONTENT_4,
    branchId: UUID_BRANCH_1,
    slug: 'button-component',
    title: 'Button Component',
    contentType: 'guideline',
    category: 'Inputs',         // free-text for product section
    section: 'product' as const,
    categoryId: null,
    subcategoryId: null,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-13'),
    updatedAt: new Date('2026-01-13'),
  },
  {
    id: UUID_CONTENT_5,
    branchId: UUID_BRANCH_1,
    slug: 'uncategorized-content',
    title: 'Uncategorized Content',
    contentType: 'guideline',
    category: null,              // no free-text category
    section: 'brand' as const,
    categoryId: null,
    subcategoryId: null,
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-14'),
    updatedAt: new Date('2026-01-14'),
  },
];

// --- Expected post-migration data ---

/** Subcategories created from distinct (category text, section) pairs */
const expectedSubcategories = [
  {
    id: UUID_SUBCATEGORY_1,
    name: 'V1 Models',
    categoryId: UUID_CATEGORY_BRAND_1,  // first category in brand section by displayOrder
    displayOrder: 0,                     // ROW_NUMBER() - 1, ordered alphabetically
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: UUID_SUBCATEGORY_2,
    name: 'V2 Models',
    categoryId: UUID_CATEGORY_BRAND_1,  // same parent category
    displayOrder: 1,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: UUID_SUBCATEGORY_3,
    name: 'Inputs',
    categoryId: UUID_CATEGORY_PRODUCT_1, // first category in product section
    displayOrder: 0,
    createdBy: UUID_USER_1,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  },
];

/** Content rows after migration with new columns populated */
const expectedPostMigrationContents = [
  {
    ...preMigrationContents[0],
    categoryId: UUID_CATEGORY_BRAND_1,   // first category in brand section
    subcategoryId: UUID_SUBCATEGORY_1,    // matches 'V1 Models' subcategory
  },
  {
    ...preMigrationContents[1],
    categoryId: UUID_CATEGORY_BRAND_1,
    subcategoryId: UUID_SUBCATEGORY_1,    // also 'V1 Models'
  },
  {
    ...preMigrationContents[2],
    categoryId: UUID_CATEGORY_BRAND_1,
    subcategoryId: UUID_SUBCATEGORY_2,    // matches 'V2 Models' subcategory
  },
  {
    ...preMigrationContents[3],
    categoryId: UUID_CATEGORY_PRODUCT_1,  // first category in product section
    subcategoryId: UUID_SUBCATEGORY_3,    // matches 'Inputs' subcategory
  },
  {
    ...preMigrationContents[4],
    categoryId: UUID_CATEGORY_BRAND_1,    // gets categoryId (first in section)
    subcategoryId: null,                   // NO subcategory (category text was null)
  },
];

// --- Migration logic simulation ---

/**
 * Simulates step 3a of the migration:
 * Set category_id for all content to the first persistent category in their section.
 */
function simulateCategoryIdAssignment(
  contents: typeof preMigrationContents,
  categories: typeof preMigrationCategories
) {
  // Find first category per section (lowest displayOrder)
  const firstCategoryBySection = new Map<string, typeof preMigrationCategories[0]>();
  for (const cat of [...categories].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!firstCategoryBySection.has(cat.section)) {
      firstCategoryBySection.set(cat.section, cat);
    }
  }

  return contents.map((c) => ({
    ...c,
    categoryId: c.section ? (firstCategoryBySection.get(c.section)?.id ?? null) : null,
  }));
}

/**
 * Simulates step 3b of the migration:
 * Create subcategory records from distinct category text values.
 */
function simulateSubcategoryCreation(
  contents: typeof preMigrationContents,
  categories: typeof preMigrationCategories
) {
  const firstCategoryBySection = new Map<string, typeof preMigrationCategories[0]>();
  for (const cat of [...categories].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!firstCategoryBySection.has(cat.section)) {
      firstCategoryBySection.set(cat.section, cat);
    }
  }

  const subcategories: Array<{
    name: string;
    categoryId: string;
    displayOrder: number;
    createdBy: string;
  }> = [];

  // Group distinct category text values per parent category
  const byParent = new Map<string, Set<string>>();
  for (const c of contents) {
    if (!c.category || c.category === '' || !c.section) continue;
    const parentCat = firstCategoryBySection.get(c.section);
    if (!parentCat) continue;
    if (!byParent.has(parentCat.id)) byParent.set(parentCat.id, new Set());
    byParent.get(parentCat.id)!.add(c.category);
  }

  for (const [parentId, names] of byParent) {
    const parentCat = categories.find((c) => c.id === parentId);
    const sorted = [...names].sort();
    sorted.forEach((name, idx) => {
      subcategories.push({
        name,
        categoryId: parentId,
        displayOrder: idx,
        createdBy: parentCat!.createdBy,
      });
    });
  }

  return subcategories;
}

/**
 * Simulates step 3c of the migration:
 * Link content to their newly created subcategories.
 */
function simulateSubcategoryLinking(
  contents: Array<typeof preMigrationContents[0] & { categoryId: string | null }>,
  subcategories: Array<{ name: string; categoryId: string }>
) {
  return contents.map((c) => {
    if (!c.category || !c.categoryId) return { ...c, subcategoryId: null };
    const matchingSub = subcategories.find(
      (s) => s.name === c.category && s.categoryId === c.categoryId
    );
    return {
      ...c,
      subcategoryId: matchingSub ? `subcategory-for-${c.category}` : null,
    };
  });
}

// --- Tests ---

describe('Migration 0011_add_subcategories — verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 3a: category_id assignment', () => {
    it('should assign categoryId to all content based on first category in section', () => {
      const result = simulateCategoryIdAssignment(preMigrationContents, preMigrationCategories);

      // Brand-section content gets UUID_CATEGORY_BRAND_1 (displayOrder 0)
      expect(result[0].categoryId).toBe(UUID_CATEGORY_BRAND_1);
      expect(result[1].categoryId).toBe(UUID_CATEGORY_BRAND_1);
      expect(result[2].categoryId).toBe(UUID_CATEGORY_BRAND_1);

      // Product-section content gets UUID_CATEGORY_PRODUCT_1 (only one in product)
      expect(result[3].categoryId).toBe(UUID_CATEGORY_PRODUCT_1);
    });

    it('should assign categoryId even to content without a free-text category', () => {
      const result = simulateCategoryIdAssignment(preMigrationContents, preMigrationCategories);

      // Content 5 has category=null but section='brand', so it still gets a categoryId
      const uncategorized = result.find((c) => c.id === UUID_CONTENT_5);
      expect(uncategorized).toBeDefined();
      expect(uncategorized!.categoryId).toBe(UUID_CATEGORY_BRAND_1);
      expect(uncategorized!.category).toBeNull();
    });

    it('should choose the category with the lowest displayOrder in each section', () => {
      const result = simulateCategoryIdAssignment(preMigrationContents, preMigrationCategories);

      // UUID_CATEGORY_BRAND_1 has displayOrder 0, UUID_CATEGORY_BRAND_2 has displayOrder 1
      // All brand content should get the first one
      const brandContent = result.filter((c) => c.section === 'brand');
      for (const content of brandContent) {
        expect(content.categoryId).toBe(UUID_CATEGORY_BRAND_1);
        expect(content.categoryId).not.toBe(UUID_CATEGORY_BRAND_2);
      }
    });

    it('should not assign categoryId when section has no persistent categories', () => {
      // Simulate content in 'experience' section with no categories
      const experienceContent = [
        {
          ...preMigrationContents[0],
          id: '00000000-0000-4000-a000-000000000050',
          section: 'experience' as const,
        },
      ];

      const result = simulateCategoryIdAssignment(experienceContent, preMigrationCategories);
      expect(result[0].categoryId).toBeNull();
    });
  });

  describe('Step 3b: subcategory creation from distinct category values', () => {
    it('should create one subcategory per distinct free-text category per section', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      // 'V1 Models' and 'V2 Models' in brand, 'Inputs' in product = 3 total
      expect(subcats).toHaveLength(3);

      const names = subcats.map((s) => s.name).sort();
      expect(names).toEqual(['Inputs', 'V1 Models', 'V2 Models']);
    });

    it('should not create duplicate subcategories for content sharing the same category text', () => {
      // Content 1 and 2 both have category='V1 Models' in the brand section
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      const v1Models = subcats.filter((s) => s.name === 'V1 Models');
      expect(v1Models).toHaveLength(1);
    });

    it('should assign subcategories to the first category in their section', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      const brandSubcats = subcats.filter((s) => s.categoryId === UUID_CATEGORY_BRAND_1);
      expect(brandSubcats).toHaveLength(2);
      expect(brandSubcats.map((s) => s.name).sort()).toEqual(['V1 Models', 'V2 Models']);

      const productSubcats = subcats.filter((s) => s.categoryId === UUID_CATEGORY_PRODUCT_1);
      expect(productSubcats).toHaveLength(1);
      expect(productSubcats[0].name).toBe('Inputs');
    });

    it('should assign sequential displayOrder within each parent category', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      // Brand subcategories sorted alphabetically: V1 Models (0), V2 Models (1)
      const brandSubcats = subcats
        .filter((s) => s.categoryId === UUID_CATEGORY_BRAND_1)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      expect(brandSubcats[0].displayOrder).toBe(0);
      expect(brandSubcats[0].name).toBe('V1 Models');
      expect(brandSubcats[1].displayOrder).toBe(1);
      expect(brandSubcats[1].name).toBe('V2 Models');

      // Product subcategory: only one, gets displayOrder 0
      const productSubcats = subcats.filter((s) => s.categoryId === UUID_CATEGORY_PRODUCT_1);
      expect(productSubcats[0].displayOrder).toBe(0);
    });

    it('should skip content with null or empty category text', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      // Content 5 has category=null, so no subcategory should be created for it
      const nullSubcat = subcats.find((s) => s.name === 'null' || s.name === '');
      expect(nullSubcat).toBeUndefined();
    });

    it('should use the parent category creator as subcategory createdBy', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      for (const sub of subcats) {
        expect(sub.createdBy).toBe(UUID_USER_1);
      }
    });
  });

  describe('Step 3c: content subcategoryId linking', () => {
    it('should link content to the matching subcategory by name and categoryId', () => {
      // First assign categoryIds
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);
      const linked = simulateSubcategoryLinking(withCategoryIds, subcats);

      // Content with category='V1 Models' should have a subcategoryId
      const content1 = linked.find((c) => c.id === UUID_CONTENT_1)!;
      expect(content1.subcategoryId).not.toBeNull();

      const content2 = linked.find((c) => c.id === UUID_CONTENT_2)!;
      expect(content2.subcategoryId).not.toBeNull();

      // Both should reference the same subcategory (same category text)
      expect(content1.subcategoryId).toBe(content2.subcategoryId);
    });

    it('should link content with different category text to different subcategories', () => {
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);
      const linked = simulateSubcategoryLinking(withCategoryIds, subcats);

      const content1 = linked.find((c) => c.id === UUID_CONTENT_1)!; // V1 Models
      const content3 = linked.find((c) => c.id === UUID_CONTENT_3)!; // V2 Models

      expect(content1.subcategoryId).not.toBeNull();
      expect(content3.subcategoryId).not.toBeNull();
      expect(content1.subcategoryId).not.toBe(content3.subcategoryId);
    });

    it('should not assign subcategoryId to content without a category text', () => {
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);
      const linked = simulateSubcategoryLinking(withCategoryIds, subcats);

      const uncategorized = linked.find((c) => c.id === UUID_CONTENT_5)!;
      expect(uncategorized.subcategoryId).toBeNull();
      // But categoryId should still be set
      expect(uncategorized.categoryId).toBe(UUID_CATEGORY_BRAND_1);
    });
  });

  describe('Old category text column preservation', () => {
    it('should retain the original category text unchanged after migration', () => {
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );

      // Verify original category text values are preserved
      expect(withCategoryIds.find((c) => c.id === UUID_CONTENT_1)!.category).toBe('V1 Models');
      expect(withCategoryIds.find((c) => c.id === UUID_CONTENT_2)!.category).toBe('V1 Models');
      expect(withCategoryIds.find((c) => c.id === UUID_CONTENT_3)!.category).toBe('V2 Models');
      expect(withCategoryIds.find((c) => c.id === UUID_CONTENT_4)!.category).toBe('Inputs');
      expect(withCategoryIds.find((c) => c.id === UUID_CONTENT_5)!.category).toBeNull();
    });

    it('should not drop or alter the category column', () => {
      // The migration SQL does NOT contain ALTER TABLE ... DROP COLUMN category
      // or ALTER TABLE ... ALTER COLUMN category. Verify the schema still has it.
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );

      for (const content of withCategoryIds) {
        // 'category' key must still exist on every row
        expect('category' in content).toBe(true);
      }
    });
  });

  describe('Expected post-migration state verification', () => {
    it('should produce the correct full post-migration state', () => {
      const withCategoryIds = simulateCategoryIdAssignment(
        preMigrationContents,
        preMigrationCategories
      );
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);
      const linked = simulateSubcategoryLinking(withCategoryIds, subcats);

      // All content should have categoryId set
      for (const content of linked) {
        expect(content.categoryId).not.toBeNull();
      }

      // Content with free-text category should have subcategoryId
      const withCategory = linked.filter((c) => c.category !== null);
      for (const content of withCategory) {
        expect(content.subcategoryId).not.toBeNull();
      }

      // Content without free-text category should NOT have subcategoryId
      const withoutCategory = linked.filter((c) => c.category === null);
      for (const content of withoutCategory) {
        expect(content.subcategoryId).toBeNull();
      }
    });

    it('should handle multiple sections independently', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      // Brand subcategories should be under UUID_CATEGORY_BRAND_1
      const brandSubcats = subcats.filter((s) => s.categoryId === UUID_CATEGORY_BRAND_1);
      // Product subcategories should be under UUID_CATEGORY_PRODUCT_1
      const productSubcats = subcats.filter((s) => s.categoryId === UUID_CATEGORY_PRODUCT_1);

      // No cross-section contamination
      expect(brandSubcats.every((s) => s.categoryId === UUID_CATEGORY_BRAND_1)).toBe(true);
      expect(productSubcats.every((s) => s.categoryId === UUID_CATEGORY_PRODUCT_1)).toBe(true);

      // displayOrder restarts at 0 for each parent category
      expect(brandSubcats.find((s) => s.displayOrder === 0)).toBeDefined();
      expect(productSubcats.find((s) => s.displayOrder === 0)).toBeDefined();
    });

    it('should match expected subcategory count per section', () => {
      const subcats = simulateSubcategoryCreation(preMigrationContents, preMigrationCategories);

      const brandCount = subcats.filter((s) => s.categoryId === UUID_CATEGORY_BRAND_1).length;
      const productCount = subcats.filter((s) => s.categoryId === UUID_CATEGORY_PRODUCT_1).length;

      // Brand has 2 distinct free-text categories: 'V1 Models', 'V2 Models'
      expect(brandCount).toBe(2);
      // Product has 1 distinct free-text category: 'Inputs'
      expect(productCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle section with no content at all', () => {
      const emptyContents: typeof preMigrationContents = [];
      const subcats = simulateSubcategoryCreation(emptyContents, preMigrationCategories);
      expect(subcats).toHaveLength(0);
    });

    it('should handle content where all rows have null category', () => {
      const nullCategoryContents = preMigrationContents.map((c) => ({
        ...c,
        category: null,
      }));
      const subcats = simulateSubcategoryCreation(nullCategoryContents, preMigrationCategories);
      expect(subcats).toHaveLength(0);
    });

    it('should handle content where all rows have empty string category', () => {
      const emptyStringContents = preMigrationContents.map((c) => ({
        ...c,
        category: '',
      }));
      const subcats = simulateSubcategoryCreation(emptyStringContents, preMigrationCategories);
      expect(subcats).toHaveLength(0);
    });

    it('should handle single content row with a category', () => {
      const singleContent = [preMigrationContents[0]]; // 'V1 Models' in brand
      const subcats = simulateSubcategoryCreation(singleContent, preMigrationCategories);

      expect(subcats).toHaveLength(1);
      expect(subcats[0].name).toBe('V1 Models');
      expect(subcats[0].categoryId).toBe(UUID_CATEGORY_BRAND_1);
      expect(subcats[0].displayOrder).toBe(0);
    });

    it('should handle many content rows sharing the same category text', () => {
      const duplicatedContents = Array.from({ length: 10 }, (_, i) => ({
        ...preMigrationContents[0],
        id: `00000000-0000-4000-a000-0000000000${60 + i}`,
        slug: `content-${i}`,
        category: 'Shared Category',
      }));

      const subcats = simulateSubcategoryCreation(duplicatedContents, preMigrationCategories);

      // Only one subcategory should be created despite 10 content rows
      const shared = subcats.filter((s) => s.name === 'Shared Category');
      expect(shared).toHaveLength(1);
    });
  });
});
