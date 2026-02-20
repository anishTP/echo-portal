import { db } from '../../db/index.js';
import {
  convergenceOperations,
  type ConvergenceOperation,
  type NewConvergenceOperation,
} from '../../db/schema/convergence.js';
import { branches } from '../../db/schema/branches.js';
import { sectionPages } from '../../db/schema/landing-pages.js';
import { categoryPages } from '../../db/schema/landing-pages.js';
import { eq, and, desc } from 'drizzle-orm';
import {
  ConvergenceModel,
  createConvergenceModel,
  createConvergenceSchema,
  type CreateConvergenceInput,
} from '../../models/convergence.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../../api/utils/errors.js';
import {
  ConvergenceStatus,
  BranchState,
  TransitionEvent,
} from '@echo-portal/shared';
import type { ValidationResult, ConflictDetail } from '@echo-portal/shared';
import { conflictDetectionService } from './conflict-detection.js';
import { lockingService } from './locking.js';
import { mergeService } from './merge.js';
import { transitionService } from '../workflow/transitions.js';
import { contentMergeService } from '../content/content-merge-service.js';
import { branchService } from '../branch/branch-service.js';

export interface ConvergenceListOptions {
  branchId?: string;
  publisherId?: string;
  status?: string[];
  page?: number;
  limit?: number;
}

export interface ConvergenceListResult {
  operations: ConvergenceModel[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ValidationCheckResult {
  isValid: boolean;
  results: ValidationResult[];
  conflicts: ConflictDetail[];
}

export class ConvergenceService {
  /**
   * Create a new convergence operation
   */
  async create(
    input: CreateConvergenceInput,
    publisherId: string,
    publisherRoles: string[]
  ): Promise<ConvergenceModel> {
    // Validate input
    const parsed = createConvergenceSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid convergence input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { branchId } = parsed.data;

    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    // Validate branch is in approved state
    if (branch.state !== BranchState.APPROVED) {
      throw new ValidationError(
        `Branch must be in 'approved' state to publish. Current state: '${branch.state}'`
      );
    }

    // Validate publisher has permission
    if (
      !publisherRoles.includes('publisher') &&
      !publisherRoles.includes('administrator')
    ) {
      throw new ForbiddenError('Only publishers or administrators can publish branches');
    }

    // Check for existing active convergence
    const existing = await db.query.convergenceOperations.findFirst({
      where: eq(convergenceOperations.branchId, branchId),
      orderBy: [desc(convergenceOperations.createdAt)],
    });

    if (
      existing &&
      (existing.status === ConvergenceStatus.PENDING ||
        existing.status === ConvergenceStatus.VALIDATING ||
        existing.status === ConvergenceStatus.MERGING)
    ) {
      throw new ConflictError(
        'A convergence operation is already in progress for this branch'
      );
    }

    // Create the convergence operation
    const newOperation: NewConvergenceOperation = {
      branchId,
      publisherId,
      status: ConvergenceStatus.PENDING,
      validationResults: [],
      conflictDetected: false,
      targetRef: branch.baseRef,
    };

    const [inserted] = await db
      .insert(convergenceOperations)
      .values(newOperation)
      .returning();

    return createConvergenceModel(inserted);
  }

  /**
   * Get a convergence operation by ID
   */
  async getById(id: string): Promise<ConvergenceModel | null> {
    const operation = await db.query.convergenceOperations.findFirst({
      where: eq(convergenceOperations.id, id),
    });

    if (!operation) {
      return null;
    }

    return createConvergenceModel(operation);
  }

  /**
   * Get a convergence operation by ID, throwing if not found
   */
  async getByIdOrThrow(id: string): Promise<ConvergenceModel> {
    const operation = await this.getById(id);
    if (!operation) {
      throw new NotFoundError('Convergence', id);
    }
    return operation;
  }

  /**
   * Validate a branch for convergence (pre-check)
   */
  async validate(branchId: string): Promise<ValidationCheckResult> {
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    const results: ValidationResult[] = [];
    const conflicts: ConflictDetail[] = [];

    // Check 1: Branch is in approved state
    results.push({
      check: 'branch_approved',
      passed: branch.state === BranchState.APPROVED,
      message:
        branch.state === BranchState.APPROVED
          ? 'Branch is approved'
          : `Branch is in '${branch.state}' state, must be 'approved'`,
    });

    // Check 2: Branch has commits ahead of base
    results.push({
      check: 'has_changes',
      passed: branch.headCommit !== branch.baseCommit,
      message:
        branch.headCommit !== branch.baseCommit
          ? 'Branch has changes to merge'
          : 'Branch has no changes to merge',
    });

    // Check 3: No git conflicts with target
    const conflictResult = await conflictDetectionService.checkConflicts(
      branch.gitRef,
      branch.baseRef
    );

    results.push({
      check: 'no_git_conflicts',
      passed: !conflictResult.hasConflicts,
      message: conflictResult.hasConflicts
        ? `${conflictResult.conflicts.length} git conflict(s) detected`
        : 'No git conflicts detected',
    });

    if (conflictResult.hasConflicts) {
      conflicts.push(...conflictResult.conflicts);
    }

    // Check 4: No content merge conflicts
    const mainBranch = await branchService.getMainBranch();
    if (mainBranch) {
      const contentMergePreview = await contentMergeService.detectConflicts(
        branchId,
        mainBranch.id
      );

      results.push({
        check: 'no_content_conflicts',
        passed: contentMergePreview.canMerge,
        message: contentMergePreview.canMerge
          ? 'No content conflicts detected'
          : `${contentMergePreview.conflicts.length} content conflict(s) detected`,
      });

      if (!contentMergePreview.canMerge) {
        // Add content conflicts to the list
        for (const conflict of contentMergePreview.conflicts) {
          conflicts.push({
            path: conflict.slug,
            type: 'content',
            description: conflict.description,
          });
        }
      }
    }

    return {
      isValid: results.every((r) => r.passed),
      results,
      conflicts,
    };
  }

  /**
   * Execute a convergence operation
   */
  async execute(
    id: string,
    publisherId: string,
    publisherRoles: string[]
  ): Promise<ConvergenceModel> {
    const operation = await this.getByIdOrThrow(id);

    // Validate operation can be started
    if (!operation.canStart()) {
      throw new ValidationError(
        `Cannot start convergence in '${operation.status}' status`
      );
    }

    // Get the branch
    const branch = await db.query.branches.findFirst({
      where: eq(branches.id, operation.branchId),
    });

    if (!branch) {
      throw new NotFoundError('Branch', operation.branchId);
    }

    // Attempt to acquire lock
    const lockResult = await lockingService.acquireLock(
      operation.branchId,
      operation.targetRef,
      operation.id
    );

    if (!lockResult.acquired) {
      throw new ConflictError(lockResult.reason || 'Could not acquire lock');
    }

    try {
      // Run validation
      const validation = await this.validate(operation.branchId);

      // Update operation with validation results
      await db
        .update(convergenceOperations)
        .set({
          validationResults: validation.results,
          conflictDetected: validation.conflicts.length > 0,
          conflictDetails: validation.conflicts.length > 0 ? validation.conflicts : null,
        })
        .where(eq(convergenceOperations.id, id));

      if (!validation.isValid) {
        await lockingService.releaseLock(id, 'failed');
        const updated = await this.getByIdOrThrow(id);
        return updated;
      }

      // Transition to merging
      await lockingService.transitionToMerging(id);

      // Perform the merge
      const mergeResult = await mergeService.atomicMerge({
        branchRef: branch.gitRef,
        targetRef: operation.targetRef,
        branchId: operation.branchId,
        publisherId,
        message: mergeService.getConvergenceMergeMessage(branch.name, branch.id),
      });

      if (!mergeResult.success) {
        await db
          .update(convergenceOperations)
          .set({
            conflictDetected: true,
            conflictDetails: [
              {
                path: '*',
                type: 'content',
                description: mergeResult.error || 'Merge failed',
              },
            ],
          })
          .where(eq(convergenceOperations.id, id));

        await lockingService.releaseLock(
          id,
          mergeResult.rolledBack ? 'rolled_back' : 'failed'
        );
        const updated = await this.getByIdOrThrow(id);
        return updated;
      }

      // Update operation with merge commit
      await db
        .update(convergenceOperations)
        .set({
          mergeCommit: mergeResult.mergeCommit,
        })
        .where(eq(convergenceOperations.id, id));

      // Merge content into main branch
      const mainBranch = await branchService.getMainBranch();
      if (mainBranch) {
        const contentMergeResult = await contentMergeService.mergeContentIntoMain(
          operation.branchId,
          mainBranch.id,
          publisherId
        );

        if (!contentMergeResult.success) {
          // Content merge failed - this shouldn't happen if validation passed
          await db
            .update(convergenceOperations)
            .set({
              conflictDetected: true,
              conflictDetails: contentMergeResult.conflicts.map((c) => ({
                path: c.slug,
                type: 'content' as const,
                description: c.description,
              })),
            })
            .where(eq(convergenceOperations.id, id));

          await lockingService.releaseLock(id, 'failed');
          const updated = await this.getByIdOrThrow(id);
          return updated;
        }
      }

      // Merge landing page bodies from branch to main
      if (mainBranch) {
        await this.mergeLandingPages(operation.branchId, mainBranch.id, publisherId);
      }

      // Transition branch to published state
      await transitionService.executeTransition({
        branchId: operation.branchId,
        event: TransitionEvent.PUBLISH,
        actorId: publisherId,
        actorRoles: publisherRoles,
        reason: `Published via convergence ${id}`,
        metadata: { convergenceId: id, mergeCommit: mergeResult.mergeCommit },
      });

      // Release lock with success
      await lockingService.releaseLock(id, 'succeeded');

      return this.getByIdOrThrow(id);
    } catch (error) {
      // On any error, release the lock
      await lockingService.releaseLock(id, 'failed');
      throw error;
    }
  }

  /**
   * Merge landing page bodies from a branch into the main branch.
   * Upserts section_pages and category_pages, then deletes branch-specific rows.
   */
  private async mergeLandingPages(
    branchId: string,
    mainBranchId: string,
    publisherId: string
  ): Promise<void> {
    // Upsert section pages
    const branchSectionPages = await db
      .select()
      .from(sectionPages)
      .where(eq(sectionPages.branchId, branchId));

    for (const page of branchSectionPages) {
      const existing = await db
        .select()
        .from(sectionPages)
        .where(
          and(
            eq(sectionPages.section, page.section),
            eq(sectionPages.branchId, mainBranchId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(sectionPages)
          .set({ body: page.body, updatedAt: new Date() })
          .where(eq(sectionPages.id, existing[0].id));
      } else {
        await db.insert(sectionPages).values({
          section: page.section,
          branchId: mainBranchId,
          body: page.body,
          createdBy: publisherId,
        });
      }
    }

    // Upsert category pages
    const branchCategoryPages = await db
      .select()
      .from(categoryPages)
      .where(eq(categoryPages.branchId, branchId));

    for (const page of branchCategoryPages) {
      const existing = await db
        .select()
        .from(categoryPages)
        .where(
          and(
            eq(categoryPages.categoryId, page.categoryId),
            eq(categoryPages.branchId, mainBranchId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(categoryPages)
          .set({ body: page.body, updatedAt: new Date() })
          .where(eq(categoryPages.id, existing[0].id));
      } else {
        await db.insert(categoryPages).values({
          categoryId: page.categoryId,
          branchId: mainBranchId,
          body: page.body,
          createdBy: publisherId,
        });
      }
    }

    // Clean up branch-specific landing page rows
    if (branchSectionPages.length > 0) {
      await db.delete(sectionPages).where(eq(sectionPages.branchId, branchId));
    }
    if (branchCategoryPages.length > 0) {
      await db.delete(categoryPages).where(eq(categoryPages.branchId, branchId));
    }
  }

  /**
   * Get convergence operations for a branch
   */
  async getByBranch(branchId: string): Promise<ConvergenceModel[]> {
    const operations = await db.query.convergenceOperations.findMany({
      where: eq(convergenceOperations.branchId, branchId),
      orderBy: [desc(convergenceOperations.createdAt)],
    });

    return operations.map(createConvergenceModel);
  }

  /**
   * Get the latest convergence operation for a branch
   */
  async getLatest(branchId: string): Promise<ConvergenceModel | null> {
    const operation = await db.query.convergenceOperations.findFirst({
      where: eq(convergenceOperations.branchId, branchId),
      orderBy: [desc(convergenceOperations.createdAt)],
    });

    if (!operation) {
      return null;
    }

    return createConvergenceModel(operation);
  }

  /**
   * Cancel a pending convergence operation
   */
  async cancel(
    id: string,
    actorId: string
  ): Promise<ConvergenceModel> {
    const operation = await this.getByIdOrThrow(id);

    // Can only cancel pending operations
    if (operation.status !== ConvergenceStatus.PENDING) {
      throw new ValidationError(
        `Cannot cancel convergence in '${operation.status}' status`
      );
    }

    // Only the publisher who created it can cancel
    if (operation.publisherId !== actorId) {
      throw new ForbiddenError('Only the publisher who initiated this can cancel it');
    }

    await db
      .update(convergenceOperations)
      .set({
        status: ConvergenceStatus.FAILED,
        completedAt: new Date(),
      })
      .where(eq(convergenceOperations.id, id));

    return this.getByIdOrThrow(id);
  }
}

// Export singleton instance
export const convergenceService = new ConvergenceService();
