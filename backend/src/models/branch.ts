import { z } from 'zod';
import type { Branch, NewBranch } from '../db/schema/branches.js';
import {
  BranchState,
  Visibility,
  ValidTransitions,
  type BranchStateType,
  type VisibilityType,
} from '@echo-portal/shared';

/**
 * Validation schema for creating a new branch
 */
export const createBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name is required')
    .max(200, 'Branch name must be 200 characters or less')
    .regex(/^[a-zA-Z0-9]/, 'Branch name must start with alphanumeric character'),
  baseRef: z.enum(['main', 'dev']).default('main'),
  description: z.string().max(10000).optional(),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  labels: z.array(z.string().max(50)).max(20).default([]),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

/**
 * Validation schema for updating a branch
 */
export const updateBranchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9]/, 'Branch name must start with alphanumeric character')
    .optional(),
  description: z.string().max(10000).optional().nullable(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
  reviewers: z.array(z.string().uuid()).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

/**
 * Generate a URL-safe slug from a branch name
 */
export function generateSlug(name: string, ownerId: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);

  // Add a unique suffix based on owner and timestamp
  const uniqueSuffix = `${ownerId.substring(0, 8)}-${Date.now().toString(36)}`;
  return `${baseSlug}-${uniqueSuffix}`;
}

/**
 * Validate a state transition
 */
export function isValidTransition(fromState: BranchStateType, toState: BranchStateType): boolean {
  const validTargets = ValidTransitions[fromState];
  return validTargets.includes(toState);
}

/**
 * Get the list of valid transitions from a state
 */
export function getValidTransitions(fromState: BranchStateType): BranchStateType[] {
  return ValidTransitions[fromState] || [];
}

/**
 * Check if a branch can be edited (only draft branches can be edited)
 */
export function canEdit(branch: Branch): boolean {
  return branch.state === BranchState.DRAFT;
}

/**
 * Check if a branch can be submitted for review
 */
export function canSubmitForReview(branch: Branch): boolean {
  return branch.state === BranchState.DRAFT;
}

/**
 * Check if a branch can be approved
 */
export function canApprove(branch: Branch): boolean {
  return branch.state === BranchState.REVIEW;
}

/**
 * Check if a branch can be published
 */
export function canPublish(branch: Branch): boolean {
  return branch.state === BranchState.APPROVED;
}

/**
 * Check if a branch can be archived
 */
export function canArchive(branch: Branch): boolean {
  return branch.state !== BranchState.ARCHIVED;
}

/**
 * Check if a user can access a branch based on visibility
 */
export function canAccessBranch(
  branch: Branch,
  userId: string | null,
  userTeamIds: string[] = []
): boolean {
  // Public branches are accessible to everyone
  if (branch.visibility === Visibility.PUBLIC) {
    return true;
  }

  // Must be authenticated for non-public branches
  if (!userId) {
    return false;
  }

  // Owner can always access their branches
  if (branch.ownerId === userId) {
    return true;
  }

  // Reviewers can access
  if (branch.reviewers && branch.reviewers.includes(userId)) {
    return true;
  }

  // Team visibility - would check team membership in real implementation
  if (branch.visibility === Visibility.TEAM) {
    // In a real implementation, check if user is in the same team
    // For now, allow team visibility for authenticated users
    return true;
  }

  // Private branches are only accessible to owner and reviewers
  return false;
}

/**
 * Branch model class for business logic
 */
export class BranchModel {
  private data: Branch;

  constructor(data: Branch) {
    this.data = data;
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get slug(): string {
    return this.data.slug;
  }

  get gitRef(): string {
    return this.data.gitRef;
  }

  get baseRef(): string {
    return this.data.baseRef;
  }

  get state(): BranchStateType {
    return this.data.state as BranchStateType;
  }

  get visibility(): VisibilityType {
    return this.data.visibility as VisibilityType;
  }

  get ownerId(): string {
    return this.data.ownerId;
  }

  get reviewers(): string[] {
    return this.data.reviewers || [];
  }

  get description(): string | null {
    return this.data.description;
  }

  get labels(): string[] {
    return this.data.labels || [];
  }

  get baseCommit(): string {
    return this.data.baseCommit;
  }

  get headCommit(): string {
    return this.data.headCommit;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  get submittedAt(): Date | null {
    return this.data.submittedAt;
  }

  get approvedAt(): Date | null {
    return this.data.approvedAt;
  }

  get publishedAt(): Date | null {
    return this.data.publishedAt;
  }

  get archivedAt(): Date | null {
    return this.data.archivedAt;
  }

  /**
   * Check if this branch can be edited
   */
  canEdit(): boolean {
    return canEdit(this.data);
  }

  /**
   * Check if this branch can be submitted for review
   */
  canSubmitForReview(): boolean {
    return canSubmitForReview(this.data);
  }

  /**
   * Check if this branch can be approved
   */
  canApprove(): boolean {
    return canApprove(this.data);
  }

  /**
   * Check if this branch can be published
   */
  canPublish(): boolean {
    return canPublish(this.data);
  }

  /**
   * Check if this branch can be archived
   */
  canArchive(): boolean {
    return canArchive(this.data);
  }

  /**
   * Check if a transition to the given state is valid
   */
  canTransitionTo(toState: BranchStateType): boolean {
    return isValidTransition(this.state, toState);
  }

  /**
   * Get valid transitions from current state
   */
  getValidTransitions(): BranchStateType[] {
    return getValidTransitions(this.state);
  }

  /**
   * Check if a user can access this branch
   */
  canAccess(userId: string | null, userTeamIds: string[] = []): boolean {
    return canAccessBranch(this.data, userId, userTeamIds);
  }

  /**
   * Check if a user is the owner of this branch
   */
  isOwner(userId: string): boolean {
    return this.data.ownerId === userId;
  }

  /**
   * Check if a user is a reviewer of this branch
   */
  isReviewer(userId: string): boolean {
    return this.reviewers.includes(userId);
  }

  /**
   * Get the raw data
   */
  toJSON(): Branch {
    return { ...this.data };
  }

  /**
   * Get a serializable representation for API responses
   */
  toResponse(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      gitRef: this.gitRef,
      baseRef: this.baseRef,
      baseCommit: this.baseCommit,
      headCommit: this.headCommit,
      state: this.state,
      visibility: this.visibility,
      ownerId: this.ownerId,
      reviewers: this.reviewers,
      description: this.description,
      labels: this.labels,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      submittedAt: this.submittedAt?.toISOString() ?? null,
      approvedAt: this.approvedAt?.toISOString() ?? null,
      publishedAt: this.publishedAt?.toISOString() ?? null,
      archivedAt: this.archivedAt?.toISOString() ?? null,
      permissions: {
        canEdit: this.canEdit(),
        canSubmitForReview: this.canSubmitForReview(),
        canApprove: this.canApprove(),
        canPublish: this.canPublish(),
        canArchive: this.canArchive(),
        validTransitions: this.getValidTransitions(),
      },
    };
  }
}

/**
 * Create a BranchModel from raw data
 */
export function createBranchModel(data: Branch): BranchModel {
  return new BranchModel(data);
}
