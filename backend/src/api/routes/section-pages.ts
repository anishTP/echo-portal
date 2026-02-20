import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRoles, type AuthEnv } from '../middleware/auth.js';
import { uuidSchema } from '../schemas/common.js';
import { success } from '../utils/responses.js';
import { db } from '../../db/index.js';
import { sectionPages } from '../../db/schema/landing-pages.js';
import { branches } from '../../db/schema/branches.js';
import { ForbiddenError } from '../utils/errors.js';

const sectionPageRoutes = new Hono<AuthEnv>();

const sectionParamSchema = z.object({
  section: z.enum(['brand', 'product', 'experience']),
});

// GET /section-pages/:section?branchId=<uuid> — Read section page body with fallback
sectionPageRoutes.get(
  '/:section',
  zValidator('param', sectionParamSchema),
  zValidator(
    'query',
    z.object({
      branchId: uuidSchema.optional(),
    })
  ),
  async (c) => {
    const { section } = c.req.valid('param');
    const { branchId } = c.req.valid('query');

    // Try branch-specific page first
    if (branchId) {
      const branchPage = await db
        .select()
        .from(sectionPages)
        .where(
          and(
            eq(sectionPages.section, section),
            eq(sectionPages.branchId, branchId)
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
        .from(sectionPages)
        .where(
          and(
            eq(sectionPages.section, section),
            eq(sectionPages.branchId, mainBranch[0].id)
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
      section,
      branchId: null,
      body: '',
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    });
  }
);

// PUT /section-pages/:section — Upsert section page body (admin only, draft branch)
sectionPageRoutes.put(
  '/:section',
  requireAuth,
  requireRoles('administrator'),
  zValidator('param', sectionParamSchema),
  zValidator(
    'json',
    z.object({
      branchId: uuidSchema,
      body: z.string(),
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const { section } = c.req.valid('param');
    const { branchId, body } = c.req.valid('json');

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
      throw new ForbiddenError('Section pages can only be modified in draft branches');
    }

    // Try to update existing row
    const existing = await db
      .select()
      .from(sectionPages)
      .where(
        and(
          eq(sectionPages.section, section),
          eq(sectionPages.branchId, branchId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(sectionPages)
        .set({ body, updatedAt: new Date() })
        .where(eq(sectionPages.id, existing[0].id))
        .returning();

      return success(c, updated);
    }

    // Insert new row
    const [created] = await db
      .insert(sectionPages)
      .values({
        section,
        branchId,
        body,
        createdBy: user.id,
      })
      .returning();

    return success(c, created);
  }
);

export { sectionPageRoutes };
