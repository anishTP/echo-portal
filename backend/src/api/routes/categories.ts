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
