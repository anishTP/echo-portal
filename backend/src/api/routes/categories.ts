import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRoles, type AuthEnv } from '../middleware/auth.js';
import { contentSectionSchema } from '../schemas/contents.js';
import { uuidSchema } from '../schemas/common.js';
import { success, created, noContent } from '../utils/responses.js';
import { db } from '../../db/index.js';
import { categories } from '../../db/schema/categories.js';
import { contents } from '../../db/schema/contents.js';

const categoryRoutes = new Hono<AuthEnv>();

// GET /categories?section=brand — List categories for a section (public)
categoryRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      section: contentSectionSchema.optional(),
    })
  ),
  async (c) => {
    const { section } = c.req.valid('query');

    const conditions = section ? eq(categories.section, section) : undefined;

    const rows = await db
      .select()
      .from(categories)
      .where(conditions)
      .orderBy(categories.displayOrder, categories.name);

    return success(c, rows);
  }
);

// POST /categories — Create a category (admin only)
categoryRoutes.post(
  '/',
  requireAuth,
  requireRoles('administrator'),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(200),
      section: contentSectionSchema,
      displayOrder: z.number().int().min(0).default(0),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    // Check for duplicate
    const existing = await db
      .select()
      .from(categories)
      .where(and(eq(categories.section, body.section), eq(categories.name, body.name)))
      .limit(1);

    if (existing.length > 0) {
      return c.json(
        { error: { code: 'DUPLICATE', message: `Category "${body.name}" already exists in section "${body.section}"` } },
        409
      );
    }

    const [row] = await db
      .insert(categories)
      .values({
        name: body.name,
        section: body.section,
        displayOrder: body.displayOrder,
        createdBy: user.id,
      })
      .returning();

    return created(c, row);
  }
);

// PUT /categories/reorder — Reorder categories within a section (admin only)
// Accepts category names (not IDs) so both persistent and content-derived categories can be reordered.
// Auto-creates persistent records for content-derived categories that don't have one yet.
categoryRoutes.put(
  '/reorder',
  requireAuth,
  requireRoles('administrator'),
  zValidator(
    'json',
    z.object({
      section: contentSectionSchema,
      order: z.array(z.string().min(1).max(200)).min(1),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const { section, order } = c.req.valid('json');

    // Fetch existing persistent categories in this section
    const sectionCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.section, section));

    const existingByName = new Map(sectionCategories.map((cat) => [cat.name, cat]));

    // Update or create persistent records for each category in order
    await db.transaction(async (tx) => {
      for (let i = 0; i < order.length; i++) {
        const name = order[i];
        const existing = existingByName.get(name);

        if (existing) {
          // Update displayOrder on existing persistent record
          await tx
            .update(categories)
            .set({ displayOrder: i })
            .where(eq(categories.id, existing.id));
        } else {
          // Auto-create persistent record for content-derived category
          await tx
            .insert(categories)
            .values({
              name,
              section,
              displayOrder: i,
              createdBy: user.id,
            });
        }
      }
    });

    return success(c, { section, order });
  }
);

// PATCH /categories/:id — Rename a category (admin only)
categoryRoutes.patch(
  '/:id',
  requireAuth,
  requireRoles('administrator'),
  zValidator('param', z.object({ id: uuidSchema })),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(200),
    })
  ),
  async (c) => {
    const { id } = c.req.valid('param');
    const { name } = c.req.valid('json');

    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' } },
        404
      );
    }

    // Check for duplicate name within same section
    const duplicate = await db
      .select()
      .from(categories)
      .where(and(eq(categories.section, existing[0].section), eq(categories.name, name)))
      .limit(1);

    if (duplicate.length > 0 && duplicate[0].id !== id) {
      return c.json(
        { error: { code: 'DUPLICATE', message: `Category "${name}" already exists in section "${existing[0].section}"` } },
        409
      );
    }

    const oldName = existing[0].name;
    const section = existing[0].section;

    // Update the category name and all content items referencing the old name
    const [updated] = await db.transaction(async (tx) => {
      const [cat] = await tx
        .update(categories)
        .set({ name })
        .where(eq(categories.id, id))
        .returning();

      // Also update all content items that reference the old category name in the same section
      if (oldName !== name) {
        await tx
          .update(contents)
          .set({ category: name })
          .where(and(eq(contents.category, oldName), eq(contents.section, section)));
      }

      return [cat];
    });

    return success(c, updated);
  }
);

// POST /categories/rename — Rename a category by name (admin only)
// Handles both persistent categories and content-derived categories
categoryRoutes.post(
  '/rename',
  requireAuth,
  requireRoles('administrator'),
  zValidator(
    'json',
    z.object({
      section: contentSectionSchema,
      oldName: z.string().min(1).max(200),
      newName: z.string().min(1).max(200),
    })
  ),
  async (c) => {
    const { section, oldName, newName } = c.req.valid('json');

    if (oldName === newName) {
      return c.json(
        { error: { code: 'NO_CHANGE', message: 'Old and new names are identical' } },
        400
      );
    }

    // Check if a persistent category with the new name already exists
    const duplicate = await db
      .select()
      .from(categories)
      .where(and(eq(categories.section, section), eq(categories.name, newName)))
      .limit(1);

    if (duplicate.length > 0) {
      return c.json(
        { error: { code: 'DUPLICATE', message: `Category "${newName}" already exists in section "${section}"` } },
        409
      );
    }

    await db.transaction(async (tx) => {
      // If a persistent category exists with the old name, rename it
      const existing = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.section, section), eq(categories.name, oldName)))
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(categories)
          .set({ name: newName })
          .where(eq(categories.id, existing[0].id));
      }

      // Update all content items that reference the old category name in this section
      await tx
        .update(contents)
        .set({ category: newName })
        .where(and(eq(contents.category, oldName), eq(contents.section, section)));
    });

    return success(c, { section, oldName, newName });
  }
);

// DELETE /categories/:id — Delete a category (admin only)
categoryRoutes.delete(
  '/:id',
  requireAuth,
  requireRoles('administrator'),
  zValidator('param', z.object({ id: uuidSchema })),
  async (c) => {
    const { id } = c.req.valid('param');

    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' } },
        404
      );
    }

    await db.delete(categories).where(eq(categories.id, id));

    return noContent(c);
  }
);

export { categoryRoutes };
