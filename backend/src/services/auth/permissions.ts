import { Role } from '@echo-portal/shared';
import type { RoleType } from '@echo-portal/shared';

export interface PermissionContext {
  userId: string;
  roles: RoleType[];
  resourceOwnerId?: string;
  branchVisibility?: 'private' | 'team' | 'public';
  branchReviewers?: string[];
}

export type Permission =
  | 'branch:create'
  | 'branch:read'
  | 'branch:update'
  | 'branch:delete'
  | 'branch:submit_review'
  | 'review:approve'
  | 'review:request_changes'
  | 'convergence:initiate'
  | 'admin:override'
  | 'audit:view_all';

const ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  [Role.CONTRIBUTOR]: ['branch:create', 'branch:read', 'branch:update', 'branch:submit_review'],
  [Role.REVIEWER]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:submit_review',
    'review:approve',
    'review:request_changes',
  ],
  [Role.PUBLISHER]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:submit_review',
    'review:approve',
    'review:request_changes',
    'convergence:initiate',
  ],
  [Role.ADMINISTRATOR]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:delete',
    'branch:submit_review',
    'review:approve',
    'review:request_changes',
    'convergence:initiate',
    'admin:override',
    'audit:view_all',
  ],
};

export function hasPermission(context: PermissionContext, permission: Permission): boolean {
  // Check role-based permissions
  for (const role of context.roles) {
    if (ROLE_PERMISSIONS[role]?.includes(permission)) {
      return true;
    }
  }
  return false;
}

export function canAccessBranch(context: PermissionContext): boolean {
  // Administrators can access all branches
  if (context.roles.includes(Role.ADMINISTRATOR)) {
    return true;
  }

  // Owner can always access their own branches
  if (context.resourceOwnerId === context.userId) {
    return true;
  }

  // Check visibility
  switch (context.branchVisibility) {
    case 'public':
      return true;
    case 'team':
      return (
        context.branchReviewers?.includes(context.userId) ||
        context.roles.includes(Role.PUBLISHER)
      );
    case 'private':
    default:
      return false;
  }
}

export function canEditBranch(context: PermissionContext, branchState: string): boolean {
  // Only draft branches can be edited
  if (branchState !== 'draft') {
    return false;
  }

  // Administrators can edit any branch
  if (context.roles.includes(Role.ADMINISTRATOR)) {
    return true;
  }

  // Only owner can edit their own draft branch
  return context.resourceOwnerId === context.userId;
}

export function canTransitionBranch(
  context: PermissionContext,
  fromState: string,
  toState: string
): boolean {
  // Archive transitions require admin for non-draft branches
  if (toState === 'archived' && fromState !== 'draft') {
    return context.roles.includes(Role.ADMINISTRATOR);
  }

  // Submit for review - owner only
  if (fromState === 'draft' && toState === 'review') {
    return context.resourceOwnerId === context.userId || context.roles.includes(Role.ADMINISTRATOR);
  }

  // Approve/Request changes - reviewer role required
  if (fromState === 'review') {
    return (
      context.roles.includes(Role.REVIEWER) ||
      context.roles.includes(Role.PUBLISHER) ||
      context.roles.includes(Role.ADMINISTRATOR)
    );
  }

  // Publish - publisher role required
  if (fromState === 'approved' && toState === 'published') {
    return context.roles.includes(Role.PUBLISHER) || context.roles.includes(Role.ADMINISTRATOR);
  }

  return false;
}
