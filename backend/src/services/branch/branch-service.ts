import { db } from '../../db/index.js';
import { branches, type Branch, type NewBranch } from '../../db/schema/branches.js';
import { branchStateTransitions } from '../../db/schema/branch-transitions.js';
import { eq, desc, and, or, ilike, inArray, sql } from 'drizzle-orm';
import { getGitOperations } from '../git/operations.js';
import { orphanDetectionService } from './orphan-detection.js';
import {
  BranchModel,
  createBranchModel,
  generateSlug,
  createBranchSchema,
  updateBranchSchema,
  type CreateBranchInput,
  type UpdateBranchInput,
} from '../../models/branch.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../../api/utils/errors.js';
import { BranchState, ActorType, Role } from '@echo-portal/shared';
import type { RoleType } from '@echo-portal/shared';
import { contentInheritanceService } from '../content/content-inheritance-service.js';

export interface BranchListOptions {
  ownerId?: string;
  state?: ('draft' | 'review' | 'approved' | 'published' | 'archived')[];
  visibility?: ('private' | 'team' | 'public')[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface EditBranchCreateInput {
  sourceContentId: string;
  name: string;
  slug: string;
}

export interface BranchListResult {
  branches: BranchModel[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class BranchService {
  /**
   * Create a new branch
   */
  async create(input: CreateBranchInput, ownerId: string): Promise<BranchModel> {
    // Validate input
    const parsed = createBranchSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid branch input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, baseRef, description, visibility, labels } = parsed.data;

    // Generate unique slug
    const slug = generateSlug(name, ownerId);

    // Get git operations
    const gitOps = getGitOperations();

    // Ensure repository is initialized
    await gitOps.ensureInitialized();

    // Create the git branch
    let gitResult;
    try {
      gitResult = await gitOps.createIsolatedBranch(slug, baseRef);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictError('A branch with this name already exists');
      }
      throw error;
    }

    // Validate branch won't be orphaned
    const canCreate = await orphanDetectionService.canCreateBranch(
      baseRef,
      gitResult.baseCommit,
      async (commit, ref) => {
        const branchCommit = await gitOps['repo'].getBranchCommit(ref);
        return branchCommit === commit || (await gitOps['repo'].getCommit(commit)) !== null;
      }
    );

    if (!canCreate.allowed) {
      // Clean up the git branch we created
      try {
        await gitOps.deleteIsolatedBranch(gitResult.gitRef);
      } catch {
        // Ignore cleanup errors
      }
      throw new ValidationError(canCreate.reason || 'Cannot create branch');
    }

    // Insert into database
    const newBranch: NewBranch = {
      name,
      slug,
      gitRef: gitResult.gitRef,
      baseRef,
      baseCommit: gitResult.baseCommit,
      headCommit: gitResult.headCommit,
      state: 'draft',
      visibility: visibility || 'private',
      ownerId,
      reviewers: [],
      description: description || null,
      labels: labels || [],
    };

    const [inserted] = await db.insert(branches).values(newBranch).returning();

    // Record the creation in the state transition log
    await db.insert(branchStateTransitions).values({
      branchId: inserted.id,
      fromState: 'draft', // Special case: creation starts at draft
      toState: 'draft',
      actorId: ownerId,
      actorType: ActorType.USER,
      reason: 'Branch created',
      metadata: { baseRef, baseCommit: gitResult.baseCommit },
    });

    // Inherit content from main if branching from main
    if (baseRef === 'main') {
      const mainBranch = await this.getMainBranch();
      if (mainBranch) {
        const inheritanceResult = await contentInheritanceService.inheritContent(
          mainBranch.id,
          inserted.id,
          gitResult.baseCommit,
          ownerId
        );
        // Log inheritance result (errors are non-fatal)
        if (inheritanceResult.errors.length > 0) {
          console.warn(
            `Content inheritance warnings for branch ${inserted.id}:`,
            inheritanceResult.errors
          );
        }
      }
    }

    return createBranchModel(inserted);
  }

  /**
   * Get a branch by ID
   * Includes auto-repair for branches stuck in 'review' state after changes were requested
   */
  async getById(id: string): Promise<BranchModel | null> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, id),
    });

    if (!branch) {
      return null;
    }

    // Auto-repair: if branch is stuck in 'review' with changes_requested, fix it
    if (branch.state === 'review') {
      const repaired = await this.autoRepairIfNeeded(branch);
      if (repaired) {
        return repaired;
      }
    }

    return createBranchModel(branch);
  }

  /**
   * Auto-repair a branch if it's stuck in 'review' state after changes were requested.
   * Returns the repaired branch model if repair was needed, null otherwise.
   *
   * NOTE: This should only trigger if:
   * 1. Branch is in REVIEW state
   * 2. There's a completed review with changes_requested
   * 3. There are NO pending reviews (which would indicate a resubmission)
   */
  private async autoRepairIfNeeded(branch: typeof branches.$inferSelect): Promise<BranchModel | null> {
    // Only auto-repair if branch is currently in review state
    if (branch.state !== 'review') {
      return null;
    }

    // Import reviews table dynamically to avoid circular dependency
    const { reviews } = await import('../../db/schema/reviews.js');

    // Check if there's a completed review with changes_requested
    const stuckReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, branch.id),
        eq(reviews.status, 'completed'),
        eq(reviews.decision, 'changes_requested')
      ),
    });

    if (!stuckReview) {
      return null; // No changes_requested review, not stuck
    }

    // Check if there are any active reviews (pending or in_progress)
    // This indicates a resubmission or active review, not a stuck branch
    const activeReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, branch.id),
        sql`${reviews.status} IN ('pending', 'in_progress')`
      ),
    });

    if (activeReview) {
      // There's an active review, so the branch was legitimately resubmitted
      // Don't auto-repair
      return null;
    }

    // Auto-repair: transition to draft (only if truly stuck)
    console.log(`[BranchService] Auto-repairing stuck branch ${branch.id} (was in review with changes_requested and no pending reviews)`);

    const [updated] = await db
      .update(branches)
      .set({
        state: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(branches.id, branch.id))
      .returning();

    // Log the repair
    await db.insert(branchStateTransitions).values({
      branchId: branch.id,
      fromState: 'review',
      toState: 'draft',
      actorId: branch.ownerId, // Attribute to owner
      actorType: ActorType.SYSTEM,
      reason: 'Auto-repair: branch was stuck in review after changes were requested',
      metadata: { autoRepair: true, reviewId: stuckReview.id },
    });

    return createBranchModel(updated);
  }

  /**
   * Get a branch by ID, throwing if not found
   */
  async getByIdOrThrow(id: string): Promise<BranchModel> {
    const branch = await this.getById(id);
    if (!branch) {
      throw new NotFoundError('Branch', id);
    }
    return branch;
  }

  /**
   * Get a branch by slug
   */
  async getBySlug(slug: string): Promise<BranchModel | null> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.slug, slug),
    });

    if (!branch) {
      return null;
    }

    return createBranchModel(branch);
  }

  /**
   * List branches with filtering and pagination
   */
  async list(options: BranchListOptions = {}): Promise<BranchListResult> {
    const { ownerId, state, visibility, search, page = 1, limit = 20 } = options;

    // Build conditions
    const conditions = [];

    if (ownerId) {
      conditions.push(eq(branches.ownerId, ownerId));
    }

    if (state && state.length > 0) {
      conditions.push(inArray(branches.state, state));
    }

    if (visibility && visibility.length > 0) {
      conditions.push(inArray(branches.visibility, visibility));
    }

    if (search) {
      conditions.push(
        or(ilike(branches.name, `%${search}%`), ilike(branches.description, `%${search}%`))
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(branches)
      .where(whereClause);

    // Get paginated results
    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(branches)
      .where(whereClause)
      .orderBy(desc(branches.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      branches: results.map(createBranchModel),
      total: count,
      page,
      limit,
      hasMore: offset + results.length < count,
    };
  }

  /**
   * Update a branch
   */
  async update(
    id: string,
    input: UpdateBranchInput,
    actorId: string
  ): Promise<BranchModel> {
    // Validate input
    const parsed = updateBranchSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid update input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    // Get existing branch
    const existing = await this.getByIdOrThrow(id);

    // Check if branch can be edited
    if (!existing.canEdit()) {
      throw new ForbiddenError(
        `Cannot update branch in '${existing.state}' state. Only draft branches can be edited.`
      );
    }

    // Check ownership
    if (existing.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can update this branch');
    }

    const { name, description, visibility, reviewers, labels, requiredApprovals } = parsed.data;

    // Build update object
    const updateData: Partial<NewBranch> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (visibility !== undefined) {
      updateData.visibility = visibility;
    }

    if (reviewers !== undefined) {
      updateData.reviewers = reviewers;
    }

    if (labels !== undefined) {
      updateData.labels = labels;
    }

    if (requiredApprovals !== undefined) {
      updateData.requiredApprovals = requiredApprovals;
    }

    // Perform update
    const [updated] = await db
      .update(branches)
      .set(updateData)
      .where(eq(branches.id, id))
      .returning();

    return createBranchModel(updated);
  }

  /**
   * Delete a branch (soft delete by archiving)
   */
  async delete(id: string, actorId: string, actorRoles: RoleType[] = []): Promise<void> {
    const existing = await this.getByIdOrThrow(id);

    // Check ownership or admin role
    const isAdmin = actorRoles.includes(Role.ADMINISTRATOR);
    if (existing.ownerId !== actorId && !isAdmin) {
      throw new ForbiddenError('Only the branch owner or administrators can delete this branch');
    }

    // Can only delete draft branches
    if (existing.state !== BranchState.DRAFT) {
      throw new ForbiddenError(
        `Cannot delete branch in '${existing.state}' state. Only draft branches can be deleted.`
      );
    }

    // Delete the git branch
    const gitOps = getGitOperations();
    try {
      await gitOps.deleteIsolatedBranch(existing.gitRef);
    } catch (error) {
      console.error('Failed to delete git branch:', error);
      // Continue with database deletion even if git deletion fails
    }

    // Archive the branch in the database
    await db
      .update(branches)
      .set({
        state: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(branches.id, id));

    // Record the deletion in the state transition log
    await db.insert(branchStateTransitions).values({
      branchId: id,
      fromState: existing.state,
      toState: 'archived',
      actorId,
      actorType: ActorType.USER,
      reason: 'Branch deleted by owner',
      metadata: {},
    });
  }

  /**
   * Repair a branch stuck in 'review' state after a failed transition.
   * This directly updates the branch state to 'draft' and logs the repair.
   */
  async repairStuckBranch(id: string, actorId: string): Promise<BranchModel> {
    const existing = await this.getByIdOrThrow(id);

    // Verify branch is stuck in review state
    if (existing.state !== 'review') {
      throw new ValidationError(`Branch is in '${existing.state}' state, not stuck in review`);
    }

    // Update the branch state to draft
    const [updated] = await db
      .update(branches)
      .set({
        state: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(branches.id, id))
      .returning();

    // Record the repair in the state transition log
    await db.insert(branchStateTransitions).values({
      branchId: id,
      fromState: 'review',
      toState: 'draft',
      actorId,
      actorType: ActorType.USER,
      reason: 'Branch repair: fixed stuck state after failed transition',
      metadata: { repairAction: true },
    });

    return createBranchModel(updated);
  }

  /**
   * Get branches owned by a user
   */
  async getByOwner(ownerId: string, includeArchived: boolean = false): Promise<BranchModel[]> {
    const conditions = [eq(branches.ownerId, ownerId)];

    if (!includeArchived) {
      conditions.push(sql`${branches.state} != 'archived'`);
    }

    const results = await db
      .select()
      .from(branches)
      .where(and(...conditions))
      .orderBy(desc(branches.updatedAt));

    return results.map(createBranchModel);
  }

  /**
   * Get branches where user is a reviewer
   */
  async getByReviewer(reviewerId: string): Promise<BranchModel[]> {
    const results = await db
      .select()
      .from(branches)
      .where(sql`${reviewerId} = ANY(${branches.reviewers})`)
      .orderBy(desc(branches.updatedAt));

    return results.map(createBranchModel);
  }

  /**
   * Add reviewers to a branch
   */
  async addReviewers(id: string, reviewerIds: string[], actorId: string): Promise<BranchModel> {
    const existing = await this.getByIdOrThrow(id);

    // Check if branch is published (immutable)
    if (existing.state === BranchState.PUBLISHED) {
      throw new ForbiddenError('Cannot modify reviewers on a published branch');
    }

    // Check ownership
    if (existing.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can add reviewers');
    }

    // Merge existing and new reviewers, removing duplicates
    const currentReviewers = existing.reviewers;
    const newReviewers = [...new Set([...currentReviewers, ...reviewerIds])];

    const [updated] = await db
      .update(branches)
      .set({
        reviewers: newReviewers,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, id))
      .returning();

    return createBranchModel(updated);
  }

  /**
   * Remove a reviewer from a branch
   * FR-017a: Auto-return to Draft if all reviewers removed from Review state
   */
  async removeReviewer(id: string, reviewerId: string, actorId: string): Promise<BranchModel> {
    const existing = await this.getByIdOrThrow(id);

    // Check if branch is published (immutable)
    if (existing.state === BranchState.PUBLISHED) {
      throw new ForbiddenError('Cannot modify reviewers on a published branch');
    }

    // Check ownership
    if (existing.ownerId !== actorId) {
      throw new ForbiddenError('Only the branch owner can remove reviewers');
    }

    const newReviewers = existing.reviewers.filter((r) => r !== reviewerId);

    // FR-017a: If removing the last reviewer from a branch in Review state,
    // automatically return to Draft state
    const shouldReturnToDraft =
      existing.state === BranchState.REVIEW && newReviewers.length === 0;

    const updateData: Partial<NewBranch> = {
      reviewers: newReviewers,
      updatedAt: new Date(),
    };

    if (shouldReturnToDraft) {
      updateData.state = BranchState.DRAFT;
      updateData.submittedAt = null;
    }

    const [updated] = await db
      .update(branches)
      .set(updateData)
      .where(eq(branches.id, id))
      .returning();

    // Log the state transition if we auto-returned to Draft
    if (shouldReturnToDraft) {
      await db.insert(branchStateTransitions).values({
        branchId: id,
        fromState: BranchState.REVIEW,
        toState: BranchState.DRAFT,
        event: 'return_to_draft',
        actorId,
        actorType: ActorType.USER,
        reason: 'All reviewers removed',
        metadata: {},
        createdAt: new Date(),
      });
    }

    return createBranchModel(updated);
  }

  /**
   * Get the canonical main branch (holds published content)
   */
  async getMainBranch(): Promise<BranchModel | null> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.slug, 'main'),
    });

    if (!branch) {
      return null;
    }

    return createBranchModel(branch);
  }

  /**
   * Get the canonical main branch, throwing if not found
   */
  async getMainBranchOrThrow(): Promise<BranchModel> {
    const branch = await this.getMainBranch();
    if (!branch) {
      throw new NotFoundError('Main branch not initialized. Run database seed to create it.');
    }
    return branch;
  }

  /**
   * Update the head commit of a branch (after changes are made)
   */
  async updateHeadCommit(id: string, headCommit: string): Promise<BranchModel> {
    // Check if branch exists and is not published
    const existing = await this.getByIdOrThrow(id);

    // Check if branch is published (immutable)
    if (existing.state === BranchState.PUBLISHED) {
      throw new ForbiddenError('Cannot update head commit on a published branch');
    }

    const [updated] = await db
      .update(branches)
      .set({
        headCommit,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError('Branch', id);
    }

    return createBranchModel(updated);
  }

  /**
   * Create a branch for editing published content.
   * Creates a new branch forked from main which inherits all published content.
   * Returns the inherited content that matches the source content ID.
   */
  async createEditBranch(
    input: EditBranchCreateInput,
    ownerId: string
  ): Promise<{ branch: ReturnType<BranchModel['toJSON']>; content: any }> {
    // Import content service dynamically to avoid circular dependency
    const { contentService } = await import('../content/content-service.js');

    // Verify source content exists and is published
    const sourceContent = await contentService.getPublishedById(input.sourceContentId);
    if (!sourceContent) {
      throw new NotFoundError('Published content', input.sourceContentId);
    }

    // Create the branch (this triggers inheritContent which copies all published content from main)
    const branch = await this.create(
      {
        name: input.name,
        baseRef: 'main',
        visibility: 'private',
        labels: [],
      },
      ownerId
    );

    // Find the inherited content (created by inheritContent during branch creation)
    // The inheritance service sets sourceContentId to the original content's ID
    const { contents } = await import('../../db/schema/contents.js');
    const inheritedContentRecord = await db.query.contents.findFirst({
      where: and(
        eq(contents.branchId, branch.id),
        eq(contents.sourceContentId, input.sourceContentId)
      ),
    });

    if (!inheritedContentRecord) {
      // This shouldn't happen if inheritance worked correctly
      throw new Error(`Content inheritance failed for source ${input.sourceContentId}`);
    }

    // Use contentService.getById to get the fully populated ContentDetail
    const inheritedContent = await contentService.getById(inheritedContentRecord.id);
    if (!inheritedContent) {
      throw new Error(`Failed to retrieve inherited content ${inheritedContentRecord.id}`);
    }

    return {
      branch: branch.toJSON(),
      content: inheritedContent,
    };
  }
}

// Export singleton instance
export const branchService = new BranchService();
