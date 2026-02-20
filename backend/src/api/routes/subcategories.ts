import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireRoles, type AuthEnv } from '../middleware/auth.js';
import { uuidSchema } from '../schemas/common.js';
import { success, created } from '../utils/responses.js';
import { logAuditEvent } from '../middleware/audit.js';
import { db } from '../../db/index.js';
import { subcategories } from '../../db/schema/subcategories.js';
import { categories } from '../../db/schema/categories.js';
import { contents } from '../../db/schema/contents.js';
import { branchService } from '../../services/branch/branch-service.js';
import { ForbiddenError } from '../utils/errors.js';

const subcategoryRoutes = new Hono<AuthEnv>();

/**
 * Assert that the given branch is in draft state.
 */
async function assertDraftBranch(branchId: string): Promise<void> {
  const branch = await branchService.getById(branchId);
  if (!branch) {
    throw new ForbiddenError('Branch not found');
  }
  if (branch.state !== 'draft') {
    throw new ForbiddenError('Subcategories can only be modified in draft branches');
  }
}

// GET /subcategories?categoryId=<uuid> — List subcategories for a category (public)
subcategoryRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      categoryId: uuidSchema,
    })
  ),
  async (c) => {
    const { categoryId } = c.req.valid('query');

    const rows = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.categoryId, categoryId))
      .orderBy(subcategories.displayOrder, subcategories.name);

    return success(c, rows);
  }
);

// POST /subcategories — Create a subcategory (contributor+, draft only)
subcategoryRoutes.post(
  '/',
  requireAuth,
  requireRoles('contributor', 'administrator'),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(200).transform((s) => s.trim()),
      categoryId: uuidSchema,
      branchId: uuidSchema,
    })
  ),
  async (c) => {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    // Validate draft branch
    await assertDraftBranch(body.branchId);

    // Validate category exists
    const cat = await db
      .select()
      .from(categories)
      .where(eq(categories.id, body.categoryId))
      .limit(1);

    if (cat.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' } },
        404
      );
    }

    // Check for duplicate name within category
    const existing = await db
      .select()
      .from(subcategories)
      .where(
        and(
          eq(subcategories.categoryId, body.categoryId),
          eq(subcategories.name, body.name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json(
        { error: { code: 'DUPLICATE', message: `Subcategory "${body.name}" already exists in this category` } },
        409
      );
    }

    // New items go to the top (displayOrder = 0), shift existing items down
    await db
      .update(subcategories)
      .set({ displayOrder: sql`${subcategories.displayOrder} + 1` })
      .where(eq(subcategories.categoryId, body.categoryId));

    // Also shift loose content in this category
    await db
      .update(contents)
      .set({ displayOrder: sql`${contents.displayOrder} + 1` })
      .where(
        and(
          eq(contents.categoryId, body.categoryId),
          sql`${contents.subcategoryId} IS NULL`
        )
      );

    const [row] = await db
      .insert(subcategories)
      .values({
        name: body.name,
        categoryId: body.categoryId,
        displayOrder: 0,
        createdBy: user.id,
      })
      .returning();

    await logAuditEvent(c, 'subcategory.created', 'subcategory', row.id, {
      name: body.name,
      categoryId: body.categoryId,
    });

    return created(c, row);
  }
);

// PATCH /subcategories/:id — Rename a subcategory (contributor+, draft only)
subcategoryRoutes.patch(
  '/:id',
  requireAuth,
  requireRoles('contributor', 'administrator'),
  zValidator('param', z.object({ id: uuidSchema })),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(200).transform((s) => s.trim()).optional(),
      branchId: uuidSchema,
      body: z.string().optional(),
    })
  ),
  async (c) => {
    const { id } = c.req.valid('param');
    const { name, branchId, body } = c.req.valid('json');

    await assertDraftBranch(branchId);

    const existing = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Subcategory not found' } },
        404
      );
    }

    // Build update set
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      // Check for duplicate name within same category
      const duplicate = await db
        .select()
        .from(subcategories)
        .where(
          and(
            eq(subcategories.categoryId, existing[0].categoryId),
            eq(subcategories.name, name)
          )
        )
        .limit(1);

      if (duplicate.length > 0 && duplicate[0].id !== id) {
        return c.json(
          { error: { code: 'DUPLICATE', message: `Subcategory "${name}" already exists in this category` } },
          409
        );
      }

      updateSet.name = name;
    }

    if (body !== undefined) {
      updateSet.body = body;
    }

    const oldName = existing[0].name;
    const [updated] = await db
      .update(subcategories)
      .set(updateSet)
      .where(eq(subcategories.id, id))
      .returning();

    if (name !== undefined) {
      await logAuditEvent(c, 'subcategory.renamed', 'subcategory', id, {
        oldName,
        newName: name,
        categoryId: existing[0].categoryId,
      });
    }

    return success(c, updated);
  }
);

// DELETE /subcategories/:id — Cascade-delete subcategory and its content (contributor+, draft only)
subcategoryRoutes.delete(
  '/:id',
  requireAuth,
  requireRoles('contributor', 'administrator'),
  zValidator('param', z.object({ id: uuidSchema })),
  zValidator(
    'query',
    z.object({
      branchId: uuidSchema,
    })
  ),
  async (c) => {
    const { id } = c.req.valid('param');
    const { branchId } = c.req.valid('query');

    await assertDraftBranch(branchId);

    const existing = await db
      .select()
      .from(subcategories)
      .where(eq(subcategories.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Subcategory not found' } },
        404
      );
    }

    // Cascade-delete content and subcategory in a transaction
    let deletedContentCount = 0;
    await db.transaction(async (tx) => {
      // Delete content assigned to this subcategory
      const deleted = await tx
        .delete(contents)
        .where(eq(contents.subcategoryId, id))
        .returning({ id: contents.id });
      deletedContentCount = deleted.length;

      // Delete the subcategory
      await tx.delete(subcategories).where(eq(subcategories.id, id));
    });

    await logAuditEvent(c, 'subcategory.deleted', 'subcategory', id, {
      name: existing[0].name,
      categoryId: existing[0].categoryId,
      deletedContentCount,
    });

    return success(c, {
      deletedSubcategory: id,
      deletedContentCount,
    });
  }
);

// PUT /subcategories/reorder — Reorder subcategories and loose content within a category (contributor+, draft only)
subcategoryRoutes.put(
  '/reorder',
  requireAuth,
  requireRoles('contributor', 'administrator'),
  zValidator(
    'json',
    z.object({
      categoryId: uuidSchema,
      branchId: uuidSchema,
      order: z.array(
        z.object({
          type: z.enum(['subcategory', 'content']),
          id: uuidSchema,
        })
      ).min(1),
    })
  ),
  async (c) => {
    const { categoryId, branchId, order } = c.req.valid('json');

    await assertDraftBranch(branchId);

    // Assign sequential displayOrder values
    let updated = 0;
    await db.transaction(async (tx) => {
      for (let i = 0; i < order.length; i++) {
        const item = order[i];
        if (item.type === 'subcategory') {
          await tx
            .update(subcategories)
            .set({ displayOrder: i })
            .where(
              and(
                eq(subcategories.id, item.id),
                eq(subcategories.categoryId, categoryId)
              )
            );
        } else {
          await tx
            .update(contents)
            .set({ displayOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(contents.id, item.id),
                eq(contents.categoryId, categoryId)
              )
            );
        }
        updated++;
      }
    });

    await logAuditEvent(c, 'subcategory.reordered', 'subcategory', categoryId, {
      categoryId,
      itemCount: order.length,
    });

    return success(c, { updated });
  }
);

export { subcategoryRoutes };
