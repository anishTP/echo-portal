import { db } from '../../db/index.js';
import { branches, type Branch } from '../../db/schema/branches.js';
import { users } from '../../db/schema/users.js';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { Visibility, type VisibilityType } from '@echo-portal/shared';
import { ForbiddenError } from '../../api/utils/errors.js';

export interface AccessContext {
  userId: string | null;
  isAuthenticated: boolean;
  roles: string[];
  teamIds?: string[];
}

export interface VisibilityCheckResult {
  canAccess: boolean;
  reason?: string;
}

/**
 * Service to enforce branch visibility rules
 */
export class VisibilityService {
  /**
   * Check if a user can access a specific branch
   */
  checkAccess(branch: Branch, context: AccessContext): VisibilityCheckResult {
    const { userId, isAuthenticated, roles } = context;

    // Administrators can access everything
    if (roles.includes('administrator')) {
      return { canAccess: true };
    }

    // Public branches are accessible to everyone
    if (branch.visibility === Visibility.PUBLIC) {
      return { canAccess: true };
    }

    // Non-public branches require authentication
    if (!isAuthenticated || !userId) {
      return {
        canAccess: false,
        reason: 'Authentication required to access this branch',
      };
    }

    // Owner always has access
    if (branch.ownerId === userId) {
      return { canAccess: true };
    }

    // Reviewers have access
    if (branch.reviewers && branch.reviewers.includes(userId)) {
      return { canAccess: true };
    }

    // Publishers can access branches in review/approved state
    if (
      roles.includes('publisher') &&
      (branch.state === 'review' || branch.state === 'approved')
    ) {
      return { canAccess: true };
    }

    // Reviewers (role) can access branches in review state
    if (roles.includes('reviewer') && branch.state === 'review') {
      return { canAccess: true };
    }

    // Team visibility
    if (branch.visibility === Visibility.TEAM) {
      // In a full implementation, this would check team membership
      // For now, allow team visibility for authenticated users with reviewer/publisher roles
      if (roles.includes('reviewer') || roles.includes('publisher')) {
        return { canAccess: true };
      }

      return {
        canAccess: false,
        reason: 'You do not have access to this team branch',
      };
    }

    // Private branches are only accessible to owner and explicit reviewers
    return {
      canAccess: false,
      reason: 'This branch is private',
    };
  }

  /**
   * Assert that a user can access a branch, throwing if not
   */
  assertAccess(branch: Branch, context: AccessContext): void {
    const result = this.checkAccess(branch, context);
    if (!result.canAccess) {
      throw new ForbiddenError(result.reason || 'Access denied');
    }
  }

  /**
   * Filter a list of branches to only those accessible by the user
   */
  filterAccessible(branches: Branch[], context: AccessContext): Branch[] {
    return branches.filter((branch) => this.checkAccess(branch, context).canAccess);
  }

  /**
   * Build a SQL condition for visibility filtering
   * This can be used in queries to filter branches at the database level
   */
  buildVisibilityCondition(context: AccessContext) {
    const { userId, isAuthenticated, roles } = context;

    // Administrators see everything - return true condition
    if (roles.includes('administrator')) {
      return sql`true`;
    }

    const conditions = [];

    // Public branches are always visible
    conditions.push(eq(branches.visibility, 'public'));

    if (isAuthenticated && userId) {
      // Owner sees their own branches
      conditions.push(eq(branches.ownerId, userId));

      // Assigned reviewers see the branch
      conditions.push(sql`${userId} = ANY(${branches.reviewers})`);

      // Publishers see review/approved branches
      if (roles.includes('publisher')) {
        conditions.push(
          and(
            inArray(branches.state, ['review', 'approved']),
            inArray(branches.visibility, ['team', 'public'])
          )
        );
      }

      // Reviewers see branches in review state with team visibility
      if (roles.includes('reviewer')) {
        conditions.push(
          and(eq(branches.state, 'review'), eq(branches.visibility, 'team'))
        );
      }

      // Team members see team-visible branches
      // In a full implementation, this would filter by team membership
      if (roles.includes('reviewer') || roles.includes('publisher')) {
        conditions.push(eq(branches.visibility, 'team'));
      }
    }

    return or(...conditions);
  }

  /**
   * Check if a user can change the visibility of a branch
   */
  canChangeVisibility(
    branch: Branch,
    newVisibility: VisibilityType,
    context: AccessContext
  ): VisibilityCheckResult {
    const { userId, roles } = context;

    // Administrators can always change visibility
    if (roles.includes('administrator')) {
      return { canAccess: true };
    }

    // Only owner can change visibility
    if (branch.ownerId !== userId) {
      return {
        canAccess: false,
        reason: 'Only the branch owner can change visibility',
      };
    }

    // Can only change visibility of draft branches
    if (branch.state !== 'draft') {
      return {
        canAccess: false,
        reason: 'Can only change visibility of draft branches',
      };
    }

    // Cannot make a branch more restrictive if there are already reviewers
    if (
      branch.reviewers &&
      branch.reviewers.length > 0 &&
      newVisibility === Visibility.PRIVATE &&
      branch.visibility !== Visibility.PRIVATE
    ) {
      return {
        canAccess: false,
        reason: 'Cannot make branch private while it has reviewers assigned',
      };
    }

    return { canAccess: true };
  }

  /**
   * Get the effective visibility of a branch for a user
   * Returns what actions the user can take based on their access
   */
  getEffectivePermissions(
    branch: Branch,
    context: AccessContext
  ): {
    canView: boolean;
    canEdit: boolean;
    canReview: boolean;
    canPublish: boolean;
    canDelete: boolean;
    canChangeVisibility: boolean;
  } {
    const { userId, roles } = context;
    const accessResult = this.checkAccess(branch, context);

    if (!accessResult.canAccess) {
      return {
        canView: false,
        canEdit: false,
        canReview: false,
        canPublish: false,
        canDelete: false,
        canChangeVisibility: false,
      };
    }

    const isOwner = branch.ownerId === userId;
    const isCollaborator = branch.collaborators?.includes(userId || '') || false;
    const isReviewer = branch.reviewers?.includes(userId || '') || false;
    const isAdmin = roles.includes('administrator');
    const hasPublisherRole = roles.includes('publisher');
    const hasReviewerRole = roles.includes('reviewer');

    return {
      canView: true,
      canEdit: (isOwner || isCollaborator || isAdmin) && branch.state === 'draft',
      canReview:
        (isReviewer || hasReviewerRole || isAdmin) && branch.state === 'review',
      canPublish:
        (hasPublisherRole || isAdmin) && branch.state === 'approved',
      canDelete: (isOwner || isAdmin) && branch.state === 'draft',
      canChangeVisibility: (isOwner || isAdmin) && branch.state === 'draft',
    };
  }
}

// Export singleton instance
export const visibilityService = new VisibilityService();
