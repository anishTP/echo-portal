import { Role } from './states.js';
import type { RoleType } from './states.js';
import type { PermissionAction } from '../types/permissions.js';

/**
 * Permission action constants
 */
export const Permission = {
  // Branch permissions
  BRANCH_CREATE: 'branch.create',
  BRANCH_VIEW: 'branch.view',
  BRANCH_EDIT: 'branch.edit',
  BRANCH_DELETE: 'branch.delete',
  BRANCH_SUBMIT: 'branch.submit',
  BRANCH_PUBLISH: 'branch.publish',

  // Review permissions
  REVIEW_APPROVE: 'review.approve',
  REVIEW_REQUEST_CHANGES: 'review.request_changes',
  REVIEW_ASSIGN: 'review.assign',

  // Collaborator permissions
  COLLABORATOR_ADD: 'collaborator.add',
  COLLABORATOR_REMOVE: 'collaborator.remove',

  // User management permissions
  USER_MANAGE: 'user.manage',
  USER_CHANGE_ROLE: 'user.change_role',

  // Audit permissions
  AUDIT_VIEW: 'audit.view',

  // Content permissions (003-content-authoring-versioning)
  CONTENT_CREATE: 'content.create',
  CONTENT_READ: 'content.read',
  CONTENT_UPDATE: 'content.update',
  CONTENT_REVERT: 'content.revert',
  CONTENT_PUBLISH: 'content.publish',
  CONTENT_ARCHIVE: 'content.archive',
  CONTENT_SEARCH: 'content.search',
} as const;

/**
 * Role-permission mapping
 * Defines base permissions for each role (FR-008)
 * Contextual permissions (branch ownership, etc.) are evaluated separately
 */
export const RolePermissions: Record<RoleType, PermissionAction[]> = {
  [Role.VIEWER]: [
    Permission.BRANCH_VIEW, // Published public content only (contextual)
    Permission.CONTENT_READ, // Published public content only
  ],
  [Role.CONTRIBUTOR]: [
    Permission.BRANCH_VIEW,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_EDIT, // Own branches only (contextual)
    Permission.BRANCH_DELETE, // Own branches only (contextual)
    Permission.BRANCH_SUBMIT,
    Permission.COLLABORATOR_ADD, // Own branches only (contextual)
    Permission.COLLABORATOR_REMOVE, // Own branches only (contextual)
    Permission.CONTENT_CREATE,
    Permission.CONTENT_READ,
    Permission.CONTENT_UPDATE,
    Permission.CONTENT_REVERT,
    Permission.CONTENT_SEARCH,
  ],
  [Role.REVIEWER]: [
    Permission.BRANCH_VIEW,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_EDIT, // Own branches only (contextual)
    Permission.BRANCH_DELETE, // Own branches only (contextual)
    Permission.BRANCH_SUBMIT,
    Permission.COLLABORATOR_ADD, // Own branches only (contextual)
    Permission.COLLABORATOR_REMOVE, // Own branches only (contextual)
    Permission.REVIEW_APPROVE, // Not own branches (FR-013)
    Permission.REVIEW_REQUEST_CHANGES,
    Permission.REVIEW_ASSIGN, // Admins or owners only (contextual)
    Permission.CONTENT_CREATE,
    Permission.CONTENT_READ,
    Permission.CONTENT_UPDATE,
    Permission.CONTENT_REVERT,
    Permission.CONTENT_SEARCH,
  ],
  [Role.ADMINISTRATOR]: [
    Permission.BRANCH_VIEW,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_EDIT,
    Permission.BRANCH_DELETE,
    Permission.BRANCH_SUBMIT,
    Permission.BRANCH_PUBLISH,
    Permission.REVIEW_APPROVE,
    Permission.REVIEW_REQUEST_CHANGES,
    Permission.REVIEW_ASSIGN,
    Permission.COLLABORATOR_ADD,
    Permission.COLLABORATOR_REMOVE,
    Permission.USER_MANAGE,
    Permission.USER_CHANGE_ROLE,
    Permission.AUDIT_VIEW,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_READ,
    Permission.CONTENT_UPDATE,
    Permission.CONTENT_REVERT,
    Permission.CONTENT_PUBLISH,
    Permission.CONTENT_ARCHIVE,
    Permission.CONTENT_SEARCH,
  ],
};

/**
 * Check if a role has a specific permission (base check, no context)
 */
export function roleHasPermission(role: RoleType, permission: PermissionAction): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}
