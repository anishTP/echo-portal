import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRoles, type AuthEnv } from '../middleware/auth.js';
import { uuidSchema } from '../schemas/common.js';
import { success } from '../utils/responses.js';
import { db } from '../../db/index.js';
import { categoryPages } from '../../db/schema/landing-pages.js';
import { branches } from '../../db/schema/branches.js';
import { categories } from '../../db/schema/categories.js';
import { ForbiddenError } from '../utils/errors.js';

const categoryPageRoutes = new Hono<AuthEnv>();

// GET /category-pages/:categoryId?branchId=<uuid> — Read category page body with fallback
categoryPageRoutes.get(
  '/:categoryId',
  zValidator('param', z.object({ categoryId: uuidSchema })),
  zValidator(
    'query',
    z.object({
      branchId: uuidSchema.optional(),
    })
  ),
  async (c) => {
    const { categoryId } = c.req.valid('param');
    const { branchId } = c.req.valid('query');

    // Verify category exists
    const cat = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (cat.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' } },
        404
      );
    }

    // Try branch-specific page first
    if (branchId) {
      const branchPage = await db
        .select()
        .from(categoryPages)
        .where(
          and(
            eq(categoryPages.categoryId, categoryId),
            eq(categoryPages.branchId, branchId)
          )
        )
        .limit(1);

      if (branchPage.length > 0) {
        return success(c, branchPage[0]);
      }
    }

    // Fallback to published (main branch) version
    const mainBranch = await db
      .select()
      .from(branches)
      .where(eq(branches.slug, 'main'))
      .limit(1);

    if (mainBranch.length > 0) {
      const publishedPage = await db
        .select()
        .from(categoryPages)
        .where(
          and(
            eq(categoryPages.categoryId, categoryId),
            eq(categoryPages.branchId, mainBranch[0].id)
          )
        )
        .limit(1);

      if (publishedPage.length > 0) {
        return success(c, publishedPage[0]);
      }
    }

    // No page exists — return empty shell
    return success(c, {
      id: null,
      categoryId,
      branchId: null,
      body: '',
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    });
  }
);

// PUT /category-pages/:categoryId — Upsert category page body (admin only, draft branch)
categoryPageRoutes.put(
  '/:categoryId',
  requireAuth,
  requireRoles('administrator'),
  zValidator('param', z.object({ categoryId: uuidSchema })),
  zValidator(
    'json',
    z.object({
      branchId: uuidSchema,
      body: z.string(),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const { categoryId } = c.req.valid('param');
    const { branchId, body } = c.req.valid('json');

    // Verify category exists
    const cat = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (cat.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' } },
        404
      );
    }

    // Verify branch exists and is in draft state
    const branch = await db
      .select()
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (branch.length === 0) {
      throw new ForbiddenError('Branch not found');
    }
    if (branch[0].state !== 'draft') {
      throw new ForbiddenError('Category pages can only be modified in draft branches');
    }

    // Try to update existing row
    const existing = await db
      .select()
      .from(categoryPages)
      .where(
        and(
          eq(categoryPages.categoryId, categoryId),
          eq(categoryPages.branchId, branchId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(categoryPages)
        .set({ body, updatedAt: new Date() })
        .where(eq(categoryPages.id, existing[0].id))
        .returning();

      return success(c, updated);
    }

    // Insert new row
    const [created] = await db
      .insert(categoryPages)
      .values({
        categoryId,
        branchId,
        body,
        createdBy: user.id,
      })
      .returning();

    return success(c, created);
  }
);

export { categoryPageRoutes };
