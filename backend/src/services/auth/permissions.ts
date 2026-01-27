import { Role, BranchState } from '@echo-portal/shared';
import type { RoleType, BranchStateType } from '@echo-portal/shared';

export interface PermissionContext {
  userId: string;
  roles: RoleType[];
  resourceOwnerId?: string;
  branchVisibility?: 'private' | 'team' | 'public';
  branchState?: BranchStateType;
  branchReviewers?: string[];
  branchCollaborators?: string[];
  isAnonymous?: boolean;
}

export type Permission =
  | 'branch:create'
  | 'branch:read'
  | 'branch:update'
  | 'branch:delete'
  | 'branch:submit_review'
  | 'branch:add_collaborator'
  | 'branch:remove_collaborator'
  | 'branch:assign_reviewer'
  | 'branch:remove_reviewer'
  | 'review:approve'
  | 'review:request_changes'
  | 'convergence:initiate'
  | 'admin:override'
  | 'admin:publish'
  | 'admin:manage_users'
  | 'admin:change_roles'
  | 'audit:view_all';

const ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  [Role.VIEWER]: ['branch:read'], // Only published public content
  [Role.CONTRIBUTOR]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:submit_review',
    'branch:add_collaborator',
    'branch:remove_collaborator',
    'branch:assign_reviewer',
    'branch:remove_reviewer',
  ],
  [Role.REVIEWER]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:submit_review',
    'branch:add_collaborator',
    'branch:remove_collaborator',
    'branch:assign_reviewer',
    'branch:remove_reviewer',
    'review:approve',
    'review:request_changes',
  ],
  [Role.ADMINISTRATOR]: [
    'branch:create',
    'branch:read',
    'branch:update',
    'branch:delete',
    'branch:submit_review',
    'branch:add_collaborator',
    'branch:remove_collaborator',
    'branch:assign_reviewer',
    'branch:remove_reviewer',
    'review:approve',
    'review:request_changes',
    'convergence:initiate',
    'admin:override',
    'admin:publish',
    'admin:manage_users',
    'admin:change_roles',
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
      context.roles.includes(Role.ADMINISTRATOR)
    );
  }

  // Publish - administrator role required
  if (fromState === 'approved' && toState === 'published') {
    return context.roles.includes(Role.ADMINISTRATOR);
  }

  return false;
}

/**
 * Check if user can add/remove collaborators on a branch (FR-017b)
 * Owner can manage collaborators on their own branches
 * Collaborators and reviewers are mutually exclusive (FR-017c)
 */
export function canManageCollaborators(context: PermissionContext): boolean {
  // Must be the owner or admin
  return (
    context.resourceOwnerId === context.userId || context.roles.includes(Role.ADMINISTRATOR)
  );
}

/**
 * Check if user can assign/remove reviewers (FR-017a)
 * Owner can assign reviewers when submitting for review
 * Collaborators and reviewers are mutually exclusive (FR-017c)
 */
export function canManageReviewers(context: PermissionContext): boolean {
  // Must be the owner or admin
  return (
    context.resourceOwnerId === context.userId || context.roles.includes(Role.ADMINISTRATOR)
  );
}

/**
 * Check if user can approve a branch (self-review prevention FR-013)
 */
export function canApproveBranch(context: PermissionContext): boolean {
  // Cannot approve own branch (self-review forbidden)
  if (context.resourceOwnerId === context.userId) {
    return false;
  }

  // Must be a reviewer or admin
  if (!context.roles.includes(Role.REVIEWER) && !context.roles.includes(Role.ADMINISTRATOR)) {
    return false;
  }

  // Must be assigned as a reviewer on this branch
  if (context.branchReviewers && !context.branchReviewers.includes(context.userId)) {
    return false;
  }

  return true;
}

/**
 * Contextual branch access check with state and collaborator awareness
 */
export function canAccessBranchContextual(context: PermissionContext): boolean {
  // Anonymous users can only view published public content
  if (context.isAnonymous) {
    return (
      context.branchState === BranchState.PUBLISHED && context.branchVisibility === 'public'
    );
  }

  // Administrators can access all branches
  if (context.roles.includes(Role.ADMINISTRATOR)) {
    return true;
  }

  // Owner can always access their own branches
  if (context.resourceOwnerId === context.userId) {
    return true;
  }

  // Collaborators can access branches based on state
  if (context.branchCollaborators?.includes(context.userId)) {
    // Collaborators have full edit access in Draft state
    if (context.branchState === BranchState.DRAFT) {
      return true;
    }
    // Collaborators have read-only access in Review and Approved states (FR-017)
    if (
      context.branchState === BranchState.REVIEW ||
      context.branchState === BranchState.APPROVED
    ) {
      return true;
    }
  }

  // Reviewers can access branches they are assigned to
  if (context.branchReviewers?.includes(context.userId)) {
    return true;
  }

  // Check visibility for other authenticated users
  switch (context.branchVisibility) {
    case 'public':
      // Published public content is visible to all
      return context.branchState === BranchState.PUBLISHED;
    case 'team':
      // Team visibility requires reviewer role or being a collaborator/reviewer
      return (
        context.roles.includes(Role.REVIEWER) || context.roles.includes(Role.ADMINISTRATOR)
      );
    case 'private':
    default:
      return false;
  }
}

/**
 * Check if user can edit a branch based on state, ownership, and collaborator status
 */
export function canEditBranchContextual(context: PermissionContext): boolean {
  // Only draft branches can be edited (immutability enforcement)
  if (context.branchState !== BranchState.DRAFT) {
    return false;
  }

  // Administrators can edit any draft branch
  if (context.roles.includes(Role.ADMINISTRATOR)) {
    return true;
  }

  // Owner can edit their own draft branch
  if (context.resourceOwnerId === context.userId) {
    return true;
  }

  // Collaborators can edit draft branches (FR-017b)
  if (context.branchCollaborators?.includes(context.userId)) {
    return true;
  }

  return false;
}

/**
 * Check if a user can be added as a collaborator (not owner, not reviewer)
 */
export function canBeCollaborator(
  targetUserId: string,
  ownerId: string,
  reviewers: string[]
): boolean {
  // Cannot be the owner
  if (targetUserId === ownerId) {
    return false;
  }

  // Cannot be a reviewer (mutual exclusion per FR-017c)
  if (reviewers.includes(targetUserId)) {
    return false;
  }

  return true;
}

/**
 * Check if a user can be assigned as a reviewer (not owner, not collaborator)
 */
export function canBeReviewer(
  targetUserId: string,
  ownerId: string,
  collaborators: string[]
): boolean {
  // Cannot be the owner (self-review forbidden per FR-013)
  if (targetUserId === ownerId) {
    return false;
  }

  // Cannot be a collaborator (mutual exclusion per FR-017c)
  if (collaborators.includes(targetUserId)) {
    return false;
  }

  return true;
}
