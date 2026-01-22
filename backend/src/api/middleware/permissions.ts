import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import {
  type Permission,
  type PermissionContext,
  hasPermission,
  canAccessBranch,
  canEditBranch,
  canTransitionBranch,
} from '../../services/auth/permissions.js';
import type { AuthEnv } from './auth.js';

export interface PermissionEnv extends AuthEnv {
  Variables: AuthEnv['Variables'] & {
    permissionContext: PermissionContext | null;
  };
}

/**
 * Middleware to check a specific permission
 */
export function requirePermission(permission: Permission) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const context: PermissionContext = {
      userId: user.id,
      roles: user.roles,
    };

    if (!hasPermission(context, permission)) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Permission denied: ${permission}`,
        },
        403
      );
    }

    c.set('permissionContext', context);
    return next();
  });
}

/**
 * Middleware factory for branch access checks
 * Requires branch info to be available in request context
 */
export function checkBranchAccess(
  getBranchInfo: (
    c: Context
  ) => Promise<{ ownerId: string; visibility: string; reviewers: string[] } | null>
) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const branchInfo = await getBranchInfo(c);

    if (!branchInfo) {
      return c.json({ error: 'Not Found', message: 'Branch not found' }, 404);
    }

    const context: PermissionContext = {
      userId: user.id,
      roles: user.roles,
      resourceOwnerId: branchInfo.ownerId,
      branchVisibility: branchInfo.visibility as 'private' | 'team' | 'public',
      branchReviewers: branchInfo.reviewers,
    };

    if (!canAccessBranch(context)) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have access to this branch',
        },
        403
      );
    }

    c.set('permissionContext', context);
    return next();
  });
}

/**
 * Check if user can edit a branch (must be in draft state)
 */
export function checkBranchEdit(
  getBranchInfo: (
    c: Context
  ) => Promise<{ ownerId: string; visibility: string; reviewers: string[]; state: string } | null>
) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const branchInfo = await getBranchInfo(c);

    if (!branchInfo) {
      return c.json({ error: 'Not Found', message: 'Branch not found' }, 404);
    }

    const context: PermissionContext = {
      userId: user.id,
      roles: user.roles,
      resourceOwnerId: branchInfo.ownerId,
      branchVisibility: branchInfo.visibility as 'private' | 'team' | 'public',
      branchReviewers: branchInfo.reviewers,
    };

    if (!canEditBranch(context, branchInfo.state)) {
      const reason =
        branchInfo.state !== 'draft'
          ? 'Branch is not in draft state'
          : 'You do not have permission to edit this branch';

      return c.json(
        {
          error: 'Forbidden',
          message: reason,
        },
        403
      );
    }

    c.set('permissionContext', context);
    return next();
  });
}

/**
 * Check if user can perform a state transition
 */
export function checkTransition(fromState: string, toState: string) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');
    const permissionContext = c.get('permissionContext');

    if (!user || !permissionContext) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    if (!canTransitionBranch(permissionContext, fromState, toState)) {
      return c.json(
        {
          error: 'Forbidden',
          message: `You cannot transition from ${fromState} to ${toState}`,
        },
        403
      );
    }

    return next();
  });
}

export { hasPermission, canAccessBranch, canEditBranch, canTransitionBranch };
