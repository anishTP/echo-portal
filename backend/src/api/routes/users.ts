import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import { success } from '../utils/responses.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { auditLogger } from '../../services/audit';
import type { RoleType } from '@echo-portal/shared';

const usersRoutes = new Hono<AuthEnv>();

/**
 * Validation schemas
 */
const roleChangeSchema = z.object({
  role: z.enum(['viewer', 'contributor', 'reviewer', 'administrator'], {
    errorMap: () => ({ message: 'Invalid role. Must be viewer, contributor, reviewer, or administrator' }),
  }),
});

const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

/**
 * T093: GET /api/v1/users - List all users
 * Admin only
 */
usersRoutes.get(
  '/',
  requireAuth,
  async (c) => {
    const user = c.get('user')!;

    // Only administrators can list users
    if (!user.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to view user list');
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        roles: users.roles,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        lockedUntil: users.lockedUntil,
        failedLoginCount: users.failedLoginCount,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return success(c, { users: allUsers });
  }
);

/**
 * T093: GET /api/v1/users/:id - Get specific user
 * Admin only
 */
usersRoutes.get(
  '/:id',
  requireAuth,
  zValidator('param', userIdParamSchema),
  async (c) => {
    const currentUser = c.get('user')!;
    const { id } = c.req.valid('param');

    // Only administrators can view user details (or users viewing themselves)
    if (!currentUser.roles.includes('administrator') && currentUser.id !== id) {
      throw new ForbiddenError('Insufficient permissions to view user details');
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        roles: users.roles,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        lockedUntil: users.lockedUntil,
        failedLoginCount: users.failedLoginCount,
        lastFailedLoginAt: users.lastFailedLoginAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundError('User', id);
    }

    return success(c, { user: targetUser });
  }
);

/**
 * T094: PUT /api/v1/users/:id/role - Change user role
 * Admin only, with self-escalation prevention (FR-009, FR-010)
 */
usersRoutes.put(
  '/:id/role',
  requireAuth,
  zValidator('param', userIdParamSchema),
  zValidator('json', roleChangeSchema),
  async (c) => {
    const currentUser = c.get('user')!;
    const { id: targetUserId } = c.req.valid('param');
    const { role: newRole } = c.req.valid('json');

    // FR-009: Only administrators can change roles
    if (!currentUser.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to change user roles');
    }

    // FR-009: Prevent self-role-change (including admins)
    if (currentUser.id === targetUserId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    // Get target user
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // Get current role
    const oldRole = targetUser.roles[0] || 'viewer';

    // Check if role is actually changing
    if (oldRole === newRole) {
      throw new BadRequestError('User already has this role');
    }

    // Update role
    const [updatedUser] = await db
      .update(users)
      .set({
        roles: [newRole as RoleType],
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        roles: users.roles,
        updatedAt: users.updatedAt,
      });

    // FR-009: Log role change to audit trail
    await auditLogger.logRoleChange(
      targetUserId,
      oldRole,
      newRole,
      currentUser.id,
      {
        targetEmail: targetUser.email,
        targetDisplayName: targetUser.displayName,
      },
      {
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
        requestId: c.req.header('x-request-id'),
      }
    );

    // SC-007: Session cache will be invalidated automatically on next validation
    // (30-second TTL ensures role change takes effect within 30 seconds)

    return success(c, {
      user: updatedUser,
      message: `Role changed from ${oldRole} to ${newRole}`,
    });
  }
);

/**
 * T095: POST /api/v1/users/:id/unlock - Unlock user account
 * Admin only
 */
usersRoutes.post(
  '/:id/unlock',
  requireAuth,
  zValidator('param', userIdParamSchema),
  async (c) => {
    const currentUser = c.get('user')!;
    const { id: targetUserId } = c.req.valid('param');

    // Only administrators can unlock accounts
    if (!currentUser.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to unlock user accounts');
    }

    // Get target user
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // Check if user is actually locked
    const isLocked = targetUser.lockedUntil && targetUser.lockedUntil > new Date();
    if (!isLocked && targetUser.failedLoginCount === 0) {
      throw new BadRequestError('User account is not locked');
    }

    // Unlock account by clearing lockout fields
    const [unlockedUser] = await db
      .update(users)
      .set({
        lockedUntil: null,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        lockedUntil: users.lockedUntil,
        failedLoginCount: users.failedLoginCount,
      });

    // Log unlock action to audit trail
    await auditLogger.log({
      action: 'user.unlocked',
      actorId: currentUser.id,
      actorType: 'user',
      resourceType: 'user',
      resourceId: targetUserId,
      outcome: 'success',
      metadata: {
        targetEmail: targetUser.email,
        targetDisplayName: targetUser.displayName,
        wasLockedUntil: targetUser.lockedUntil?.toISOString(),
        previousFailedAttempts: targetUser.failedLoginCount,
      },
      actorIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      actorUserAgent: c.req.header('user-agent'),
      requestId: c.req.header('x-request-id'),
    });

    return success(c, {
      user: unlockedUser,
      message: 'User account unlocked successfully',
    });
  }
);

/**
 * GET /api/v1/users/stats - User statistics
 * Admin only
 */
usersRoutes.get(
  '/stats',
  requireAuth,
  async (c) => {
    const user = c.get('user')!;

    // Only administrators can view stats
    if (!user.roles.includes('administrator')) {
      throw new ForbiddenError('Insufficient permissions to view user statistics');
    }

    // Count users by role
    const roleStats = await db
      .select({
        role: sql<string>`UNNEST(${users.roles})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(users)
      .groupBy(sql`UNNEST(${users.roles})`);

    // Count active vs inactive
    const activeStats = await db
      .select({
        isActive: users.isActive,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(users)
      .groupBy(users.isActive);

    // Count locked accounts
    const [lockedCount] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(users)
      .where(sql`${users.lockedUntil} > NOW()`);

    return success(c, {
      byRole: Object.fromEntries(roleStats.map((s) => [s.role, s.count])),
      byStatus: {
        active: activeStats.find((s) => s.isActive)?.count || 0,
        inactive: activeStats.find((s) => !s.isActive)?.count || 0,
      },
      lockedAccounts: lockedCount?.count || 0,
    });
  }
);

export { usersRoutes };
