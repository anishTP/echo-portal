import type { BranchStateType, VisibilityType, RoleType } from '../constants/states.js';

/**
 * Permission action types
 */
export type PermissionAction =
  | 'branch.create'
  | 'branch.view'
  | 'branch.edit'
  | 'branch.delete'
  | 'branch.submit'
  | 'branch.publish'
  | 'review.approve'
  | 'review.request_changes'
  | 'review.assign'
  | 'collaborator.add'
  | 'collaborator.remove'
  | 'user.manage'
  | 'user.change_role'
  | 'audit.view'
  | 'content.create'
  | 'content.read'
  | 'content.update'
  | 'content.revert'
  | 'content.publish'
  | 'content.archive'
  | 'content.search';

/**
 * Permission context for contextual evaluation (FR-011)
 */
export interface PermissionContext {
  // Actor
  actorId?: string;
  actorRole?: RoleType;
  isAuthenticated: boolean;

  // Resource (if applicable)
  resourceType?: 'branch' | 'user' | 'audit';
  resourceId?: string;

  // Branch-specific context
  branchState?: BranchStateType;
  branchVisibility?: VisibilityType;
  branchOwnerId?: string;
  branchCollaborators?: string[];
  branchAssignedReviewers?: string[];

  // Additional context
  metadata?: Record<string, unknown>;
}

/**
 * Permission evaluation result
 */
export interface PermissionResult {
  granted: boolean;
  reason?: string;
  requiredRole?: RoleType;
  requiredPermission?: PermissionAction;
}

/**
 * Permission check request
 */
export interface PermissionCheckRequest {
  action: PermissionAction;
  context: PermissionContext;
}
