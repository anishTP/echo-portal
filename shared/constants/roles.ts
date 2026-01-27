/**
 * Role constants for Echo Portal
 * Matches Constitution v1.0.1 canonical role names
 *
 * Four distinct roles (FR-006):
 * - Viewer: Anonymous/unauthenticated users (implicit)
 * - Contributor: Can create and manage own branches
 * - Reviewer: Can review and approve branches (not own)
 * - Administrator: Full system access including user management and publishing
 */

export const VIEWER = 'viewer';
export const CONTRIBUTOR = 'contributor';
export const REVIEWER = 'reviewer';
export const ADMINISTRATOR = 'administrator';

/**
 * All available roles
 */
export const ALL_ROLES = [VIEWER, CONTRIBUTOR, REVIEWER, ADMINISTRATOR] as const;

/**
 * Authenticated roles (excludes VIEWER)
 */
export const AUTHENTICATED_ROLES = [CONTRIBUTOR, REVIEWER, ADMINISTRATOR] as const;

/**
 * Role display names
 */
export const RoleDisplayNames: Record<string, string> = {
  [VIEWER]: 'Viewer',
  [CONTRIBUTOR]: 'Contributor',
  [REVIEWER]: 'Reviewer',
  [ADMINISTRATOR]: 'Administrator',
};

/**
 * Role descriptions
 */
export const RoleDescriptions: Record<string, string> = {
  [VIEWER]: 'Can view published public content (anonymous)',
  [CONTRIBUTOR]: 'Can create branches, edit own drafts, and submit for review',
  [REVIEWER]: 'Can review and approve branches (not own work)',
  [ADMINISTRATOR]: 'Full system access: publish content, manage users, view audit logs',
};
