import { db } from '../../db/index.js';
import { branches } from '../../db/schema/branches.js';
import { users } from '../../db/schema/users.js';
import { eq, inArray } from 'drizzle-orm';
import { NotFoundError, ValidationError, ForbiddenError } from '../../api/utils/errors.js';

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  roles: string[];
}

/**
 * Service for managing team access to branches
 */
export class TeamService {
  /**
   * Get all reviewers assigned to a branch
   */
  async getBranchReviewers(branchId: string): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    if (!branch.reviewers || branch.reviewers.length === 0) {
      return [];
    }

    const reviewerUsers = await db.query.users.findMany({
      where: inArray(users.id, branch.reviewers),
    });

    return reviewerUsers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      roles: user.roles,
    }));
  }

  /**
   * Add a reviewer to a branch
   */
  async addReviewer(
    branchId: string,
    reviewerId: string,
    actorId: string
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Only owner or admin can add reviewers
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can add reviewers');
    }

    // Cannot add yourself as reviewer
    if (reviewerId === branch.ownerId) {
      throw new ValidationError('Cannot add yourself as a reviewer');
    }

    // Check reviewer exists
    const reviewer = await db.query.users.findFirst({
      where: eq(users.id, reviewerId),
    });

    if (!reviewer) {
      throw new NotFoundError('User', reviewerId);
    }

    // Check not already a reviewer
    const currentReviewers = branch.reviewers || [];
    if (currentReviewers.includes(reviewerId)) {
      throw new ValidationError('User is already a reviewer');
    }

    // FR-017c: Mutual exclusion - cannot be both collaborator and reviewer
    const currentCollaborators = branch.collaborators || [];
    if (currentCollaborators.includes(reviewerId)) {
      throw new ValidationError(
        'User is already a collaborator. Collaborators and reviewers are mutually exclusive.'
      );
    }

    // Add reviewer
    await db
      .update(branches)
      .set({
        reviewers: [...currentReviewers, reviewerId],
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId));

    return this.getBranchReviewers(branchId);
  }

  /**
   * Remove a reviewer from a branch
   */
  async removeReviewer(
    branchId: string,
    reviewerId: string,
    actorId: string
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Only owner or admin can remove reviewers
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can remove reviewers');
    }

    // Check reviewer is assigned
    const currentReviewers = branch.reviewers || [];
    if (!currentReviewers.includes(reviewerId)) {
      throw new ValidationError('User is not a reviewer');
    }

    // Remove reviewer
    await db
      .update(branches)
      .set({
        reviewers: currentReviewers.filter((id) => id !== reviewerId),
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId));

    return this.getBranchReviewers(branchId);
  }

  /**
   * Search for users who can be added as reviewers
   */
  async searchPotentialReviewers(
    branchId: string,
    query: string,
    limit: number = 10
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Get users matching the query who are not already reviewers or collaborators (mutual exclusion)
    const currentReviewers = branch.reviewers || [];
    const currentCollaborators = branch.collaborators || [];
    const excludeIds = [...currentReviewers, ...currentCollaborators, branch.ownerId];

    const matchingUsers = await db.query.users.findMany({
      where: (u, { and, or, ilike, notInArray, eq: eqOp }) =>
        and(
          notInArray(u.id, excludeIds),
          eqOp(u.isActive, true),
          or(
            ilike(u.email, `%${query}%`),
            ilike(u.displayName, `%${query}%`)
          )
        ),
      limit,
    });

    return matchingUsers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      roles: user.roles,
    }));
  }

  /**
   * Get users who can review (have reviewer role)
   */
  async getAvailableReviewers(limit: number = 50): Promise<TeamMember[]> {
    const reviewers = await db.query.users.findMany({
      where: (u, { and, eq: eqOp, sql }) =>
        and(
          eqOp(u.isActive, true),
          sql`'reviewer' = ANY(${u.roles}) OR 'administrator' = ANY(${u.roles})`
        ),
      limit,
    });

    return reviewers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      roles: user.roles,
    }));
  }

  /**
   * Get all collaborators assigned to a branch
   */
  async getBranchCollaborators(branchId: string): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    if (!branch.collaborators || branch.collaborators.length === 0) {
      return [];
    }

    const collaboratorUsers = await db.query.users.findMany({
      where: inArray(users.id, branch.collaborators),
    });

    return collaboratorUsers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      roles: user.roles,
    }));
  }

  /**
   * Add a collaborator to a branch (with mutual exclusion check)
   */
  async addCollaborator(
    branchId: string,
    collaboratorId: string,
    actorId: string
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Check if branch is published (immutable)
    if (branch.state === 'published') {
      throw new ForbiddenError('Cannot modify collaborators on a published branch');
    }

    // Only owner or admin can add collaborators
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can add collaborators');
    }

    // Cannot add yourself as collaborator (owner)
    if (collaboratorId === branch.ownerId) {
      throw new ValidationError('Cannot add yourself as a collaborator');
    }

    // Check collaborator exists
    const collaborator = await db.query.users.findFirst({
      where: eq(users.id, collaboratorId),
    });

    if (!collaborator) {
      throw new NotFoundError('User', collaboratorId);
    }

    // Check not already a collaborator
    const currentCollaborators = branch.collaborators || [];
    if (currentCollaborators.includes(collaboratorId)) {
      throw new ValidationError('User is already a collaborator');
    }

    // FR-017c: Mutual exclusion - cannot be both collaborator and reviewer
    const currentReviewers = branch.reviewers || [];
    if (currentReviewers.includes(collaboratorId)) {
      throw new ValidationError(
        'User is already a reviewer. Collaborators and reviewers are mutually exclusive.'
      );
    }

    // Add collaborator
    await db
      .update(branches)
      .set({
        collaborators: [...currentCollaborators, collaboratorId],
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId));

    return this.getBranchCollaborators(branchId);
  }

  /**
   * Remove a collaborator from a branch
   */
  async removeCollaborator(
    branchId: string,
    collaboratorId: string,
    actorId: string
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Check if branch is published (immutable)
    if (branch.state === 'published') {
      throw new ForbiddenError('Cannot modify collaborators on a published branch');
    }

    // Only owner or admin can remove collaborators
    if (branch.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can remove collaborators');
    }

    // Check collaborator is assigned
    const currentCollaborators = branch.collaborators || [];
    if (!currentCollaborators.includes(collaboratorId)) {
      throw new ValidationError('User is not a collaborator');
    }

    // Remove collaborator
    await db
      .update(branches)
      .set({
        collaborators: currentCollaborators.filter((id) => id !== collaboratorId),
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branchId));

    return this.getBranchCollaborators(branchId);
  }

  /**
   * Search for users who can be added as collaborators
   */
  async searchPotentialCollaborators(
    branchId: string,
    query: string,
    limit: number = 10
  ): Promise<TeamMember[]> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Get users matching the query who are not already collaborators or reviewers (mutual exclusion)
    const currentCollaborators = branch.collaborators || [];
    const currentReviewers = branch.reviewers || [];
    const excludeIds = [...currentCollaborators, ...currentReviewers, branch.ownerId];

    const matchingUsers = await db.query.users.findMany({
      where: (u, { and, or, ilike, notInArray, eq: eqOp }) =>
        and(
          notInArray(u.id, excludeIds),
          eqOp(u.isActive, true),
          or(ilike(u.email, `%${query}%`), ilike(u.displayName, `%${query}%`))
        ),
      limit,
    });

    return matchingUsers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      roles: user.roles,
    }));
  }
}

// Export singleton instance
export const teamService = new TeamService();
