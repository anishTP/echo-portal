import { db } from '../../db/index.js';
import { reviews } from '../../db/schema/reviews.js';
import { contents } from '../../db/schema/contents.js';
import { eq, and } from 'drizzle-orm';
import {
  TransitionEvent,
  ReviewStatus,
  ReviewDecision,
  BranchState,
  type TransitionEventType,
  type BranchStateType,
} from '@echo-portal/shared';

/**
 * Context passed to validation guards
 */
export interface GuardContext {
  branchId: string;
  branch: {
    id: string;
    ownerId: string;
    state: BranchStateType;
    reviewers: string[];
  };
  actorId: string;
  actorRoles: string[];
  event: TransitionEventType;
  metadata: Record<string, unknown>;
}

/**
 * A validation guard that checks a condition before allowing a transition
 */
export interface ValidationGuard {
  name: string;
  check: (context: GuardContext) => Promise<boolean>;
  errorMessage: string;
}

/**
 * Guard: Actor must be the branch owner
 */
const ownerOnlyGuard: ValidationGuard = {
  name: 'ownerOnly',
  check: async (context) => {
    return context.actorId === context.branch.ownerId;
  },
  errorMessage: 'Only the branch owner can perform this action',
};

/**
 * Guard: Actor must be a designated reviewer
 */
const isReviewerGuard: ValidationGuard = {
  name: 'isReviewer',
  check: async (context) => {
    const { actorId, branch, actorRoles } = context;

    // Administrators can always review
    if (actorRoles.includes('administrator')) {
      return true;
    }

    // Check if actor is in the reviewers list
    return branch.reviewers.includes(actorId);
  },
  errorMessage: 'Only designated reviewers can perform this action',
};

/**
 * Guard: Actor cannot be the branch owner (for reviews)
 */
const notOwnerGuard: ValidationGuard = {
  name: 'notOwner',
  check: async (context) => {
    return context.actorId !== context.branch.ownerId;
  },
  errorMessage: 'Branch owner cannot review their own branch',
};

/**
 * Guard: Branch must have at least one reviewer assigned
 */
const hasReviewersGuard: ValidationGuard = {
  name: 'hasReviewers',
  check: async (context) => {
    return context.branch.reviewers.length > 0;
  },
  errorMessage: 'Branch must have at least one reviewer assigned before submitting for review',
};

/**
 * Guard: Branch must have at least one content item
 */
const hasContentGuard: ValidationGuard = {
  name: 'hasContent',
  check: async (context) => {
    const content = await db.query.contents.findFirst({
      where: eq(contents.branchId, context.branchId),
    });
    return !!content;
  },
  errorMessage: 'Cannot submit for review: branch has no content',
};

/**
 * Guard: Branch must have an approved review
 */
const hasApprovedReviewGuard: ValidationGuard = {
  name: 'hasApprovedReview',
  check: async (context) => {
    const approvedReview = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.branchId, context.branchId),
        eq(reviews.status, ReviewStatus.COMPLETED),
        eq(reviews.decision, ReviewDecision.APPROVED)
      ),
    });

    return !!approvedReview;
  },
  errorMessage: 'Branch must have at least one approved review before publishing',
};

/**
 * Guard: Branch must have required number of approvals (FR-017a)
 * Counts approved reviews and compares against branch.requiredApprovals
 */
const hasRequiredApprovalsGuard: ValidationGuard = {
  name: 'hasRequiredApprovals',
  check: async (context) => {
    // Get count of approved reviews for this branch
    const approvedReviews = await db.query.reviews.findMany({
      where: and(
        eq(reviews.branchId, context.branchId),
        eq(reviews.status, ReviewStatus.COMPLETED),
        eq(reviews.decision, ReviewDecision.APPROVED)
      ),
    });

    const approvalCount = approvedReviews.length;
    const requiredApprovals = (context.metadata.requiredApprovals as number) || 1;

    return approvalCount >= requiredApprovals;
  },
  errorMessage: 'Branch does not have enough approvals to proceed',
};

/**
 * Guard: Actor has publisher role (for publishing)
 */
const hasPublisherRoleGuard: ValidationGuard = {
  name: 'hasPublisherRole',
  check: async (context) => {
    return (
      context.actorRoles.includes('publisher') ||
      context.actorRoles.includes('administrator')
    );
  },
  errorMessage: 'Only publishers or administrators can publish branches',
};

/**
 * Guard: Branch is not already archived
 */
const notArchivedGuard: ValidationGuard = {
  name: 'notArchived',
  check: async (context) => {
    return context.branch.state !== BranchState.ARCHIVED;
  },
  errorMessage: 'Cannot perform actions on archived branches',
};

/**
 * Guard: Actor can archive (owner or admin)
 */
const canArchiveGuard: ValidationGuard = {
  name: 'canArchive',
  check: async (context) => {
    const { actorId, branch, actorRoles } = context;

    // Administrators can archive any branch
    if (actorRoles.includes('administrator')) {
      return true;
    }

    // Owners can archive their own branches
    return actorId === branch.ownerId;
  },
  errorMessage: 'Only the branch owner or administrators can archive branches',
};

/**
 * Validation guards for each transition event
 */
export const validationGuards: Record<TransitionEventType, ValidationGuard[]> = {
  [TransitionEvent.SUBMIT_FOR_REVIEW]: [
    ownerOnlyGuard,
    hasReviewersGuard,
    hasContentGuard,
    notArchivedGuard,
  ],
  [TransitionEvent.REQUEST_CHANGES]: [
    isReviewerGuard,
    notOwnerGuard,
    notArchivedGuard,
  ],
  [TransitionEvent.APPROVE]: [
    isReviewerGuard,
    notOwnerGuard,
    notArchivedGuard,
  ],
  [TransitionEvent.PUBLISH]: [
    hasPublisherRoleGuard,
    hasApprovedReviewGuard,
    notArchivedGuard,
  ],
  [TransitionEvent.ARCHIVE]: [
    canArchiveGuard,
  ],
};

/**
 * Run all guards for an event and return results
 */
export async function runValidationGuards(
  event: TransitionEventType,
  context: GuardContext
): Promise<{ passed: boolean; failedGuard?: string; error?: string }> {
  const guards = validationGuards[event] || [];

  for (const guard of guards) {
    const passed = await guard.check(context);
    if (!passed) {
      return {
        passed: false,
        failedGuard: guard.name,
        error: guard.errorMessage,
      };
    }
  }

  return { passed: true };
}

/**
 * Get all guards for an event
 */
export function getGuardsForEvent(event: TransitionEventType): ValidationGuard[] {
  return validationGuards[event] || [];
}

/**
 * Check a specific guard
 */
export async function checkGuard(
  guardName: string,
  context: GuardContext
): Promise<boolean> {
  const allGuards = Object.values(validationGuards).flat();
  const guard = allGuards.find((g) => g.name === guardName);

  if (!guard) {
    throw new Error(`Unknown guard: ${guardName}`);
  }

  return guard.check(context);
}
