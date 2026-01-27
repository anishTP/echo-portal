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

/**
 * Enhanced permission check that handles permission loss gracefully
 * Returns detailed error information for client-side handling
 */
export function requirePermissionWithGracefulHandling(permission: Permission) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    // Handle missing or expired session
    if (!user) {
      return c.json(
        {
          error: 'Unauthorized',
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          action: 'redirect_to_login',
        },
        401
      );
    }

    // Handle deactivated user
    if (user.isActive === false) {
      return c.json(
        {
          error: 'Forbidden',
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact an administrator.',
          action: 'show_deactivation_notice',
        },
        403
      );
    }

    const context: PermissionContext = {
      userId: user.id,
      roles: user.roles,
    };

    if (!hasPermission(context, permission)) {
      return c.json(
        {
          error: 'Forbidden',
          code: 'PERMISSION_DENIED',
          message: `Permission denied: ${permission}`,
          requiredPermission: permission,
          currentRoles: user.roles,
          action: 'show_permission_error',
        },
        403
      );
    }

    c.set('permissionContext', context);
    return next();
  });
}

/**
 * Check branch access with graceful error handling for access changes
 */
export function checkBranchAccessWithGracefulHandling(
  getBranchInfo: (
    c: Context
  ) => Promise<{ ownerId: string; visibility: string; reviewers: string[] } | null>
) {
  return createMiddleware<PermissionEnv>(async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        {
          error: 'Unauthorized',
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          action: 'redirect_to_login',
        },
        401
      );
    }

    const branchInfo = await getBranchInfo(c);

    if (!branchInfo) {
      return c.json(
        {
          error: 'Not Found',
          code: 'BRANCH_NOT_FOUND',
          message: 'This branch no longer exists or has been deleted.',
          action: 'redirect_to_dashboard',
        },
        404
      );
    }

    const context: PermissionContext = {
      userId: user.id,
      roles: user.roles,
      resourceOwnerId: branchInfo.ownerId,
      branchVisibility: branchInfo.visibility as 'private' | 'team' | 'public',
      branchReviewers: branchInfo.reviewers,
    };

    if (!canAccessBranch(context)) {
      // Provide detailed error for access loss scenarios
      let message = 'You no longer have access to this branch.';
      let code = 'ACCESS_REVOKED';

      if (branchInfo.visibility === 'private') {
        message = 'This branch has been made private and is only accessible to its owner.';
        code = 'BRANCH_VISIBILITY_CHANGED';
      } else if (branchInfo.visibility === 'team' && !branchInfo.reviewers.includes(user.id)) {
        message = 'You have been removed from this branch\'s team.';
        code = 'TEAM_ACCESS_REVOKED';
      }

      return c.json(
        {
          error: 'Forbidden',
          code,
          message,
          action: 'redirect_to_dashboard',
        },
        403
      );
    }

    c.set('permissionContext', context);
    return next();
  });
}

export { hasPermission, canAccessBranch, canEditBranch, canTransitionBranch };
