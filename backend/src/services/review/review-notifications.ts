import { notificationService } from '../notification/notification-service.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { eq, and, sql } from 'drizzle-orm';
import type { ReviewComment } from '@echo-portal/shared';

/**
 * Notification types for review events
 */
export const ReviewNotificationType = {
  REVIEW_REQUESTED: 'review_requested',
  REVIEW_COMMENT_ADDED: 'review_comment_added',
  REVIEW_COMMENT_REPLY: 'review_comment_reply',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_CHANGES_REQUESTED: 'review_changes_requested',
  REVIEWER_ADDED: 'reviewer_added',
  REVIEWER_REMOVED: 'reviewer_removed',
} as const;

/**
 * Notify reviewers when a branch is submitted for review
 */
export async function notifyReviewSubmitted(
  review: { id: string; branchId: string; reviewerId: string; requestedById: string },
  branchName: string
): Promise<void> {
  try {
    await notificationService.createBulk(
      [review.reviewerId],
      {
        type: ReviewNotificationType.REVIEW_REQUESTED,
        category: 'review',
        title: 'Review Requested',
        message: `You have been requested to review "${branchName}"`,
        resourceType: 'branch',
        resourceId: review.branchId,
        actorId: review.requestedById,
      },
      { branchId: review.branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send review requested notification:', error);
  }
}

/**
 * Notify when a comment is added to a review
 */
export async function notifyCommentAdded(
  review: { id: string; branchId: string; reviewerId: string; requestedById: string },
  comment: ReviewComment,
  recipientIds: string[]
): Promise<void> {
  try {
    await notificationService.createBulk(
      recipientIds,
      {
        type: ReviewNotificationType.REVIEW_COMMENT_ADDED,
        category: 'review',
        title: 'New Review Comment',
        message: 'A new comment was added to a review you\'re participating in',
        resourceType: 'branch',
        resourceId: review.branchId,
        actorId: comment.authorId,
      },
      { branchId: review.branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send comment notification:', error);
  }
}

/**
 * Notify when someone replies to a comment
 */
export async function notifyCommentReply(
  review: { id: string; branchId: string },
  reply: ReviewComment,
  threadParticipantIds: string[]
): Promise<void> {
  try {
    await notificationService.createBulk(
      threadParticipantIds,
      {
        type: ReviewNotificationType.REVIEW_COMMENT_REPLY,
        category: 'review',
        title: 'Reply to Comment',
        message: 'Someone replied to a comment thread you\'re participating in',
        resourceType: 'branch',
        resourceId: review.branchId,
        actorId: reply.authorId,
      },
      { branchId: review.branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send reply notification:', error);
  }
}

/**
 * Notify branch owner when review is approved
 */
export async function notifyReviewApproved(
  review: { id: string; branchId: string; reviewerId: string; requestedById: string },
  branchName: string
): Promise<void> {
  try {
    await notificationService.createBulk(
      [review.requestedById],
      {
        type: ReviewNotificationType.REVIEW_APPROVED,
        category: 'review',
        title: 'Review Approved',
        message: `Your branch "${branchName}" has been approved`,
        resourceType: 'branch',
        resourceId: review.branchId,
        actorId: review.reviewerId,
      },
      { branchId: review.branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send approval notification:', error);
  }
}

/**
 * Notify branch owner when changes are requested
 */
export async function notifyChangesRequested(
  review: { id: string; branchId: string; reviewerId: string; requestedById: string },
  branchName: string,
  reason?: string
): Promise<void> {
  try {
    await notificationService.createBulk(
      [review.requestedById],
      {
        type: ReviewNotificationType.REVIEW_CHANGES_REQUESTED,
        category: 'review',
        title: 'Changes Requested',
        message: `Changes have been requested on "${branchName}"${reason ? `: ${reason.slice(0, 100)}` : ''}`,
        resourceType: 'branch',
        resourceId: review.branchId,
        actorId: review.reviewerId,
      },
      { branchId: review.branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send changes requested notification:', error);
  }
}

/**
 * Notify when a reviewer is added to a review
 */
export async function notifyReviewerAdded(
  branchId: string,
  reviewerId: string,
  branchName: string,
  addedById: string
): Promise<void> {
  try {
    await notificationService.createBulk(
      [reviewerId],
      {
        type: ReviewNotificationType.REVIEWER_ADDED,
        category: 'review',
        title: 'Added as Reviewer',
        message: `You have been added as a reviewer to "${branchName}"`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId: addedById,
      },
      { branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send reviewer added notification:', error);
  }
}

/**
 * Notify when a reviewer is removed from a review
 */
export async function notifyReviewerRemoved(
  branchId: string,
  reviewerId: string,
  branchName: string,
  removedById: string
): Promise<void> {
  try {
    await notificationService.createBulk(
      [reviewerId],
      {
        type: ReviewNotificationType.REVIEWER_REMOVED,
        category: 'review',
        title: 'Removed from Review',
        message: `You have been removed as a reviewer from "${branchName}"`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId: removedById,
      },
      { branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send reviewer removed notification:', error);
  }
}

/**
 * Notify all active admins when a branch is ready to publish
 */
export async function notifyBranchReadyToPublish(
  branchId: string,
  branchName: string,
  actorId: string
): Promise<void> {
  try {
    const adminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isActive, true), sql`'administrator' = ANY(${users.roles})`));

    const adminIds = adminUsers.map((u) => u.id);
    if (adminIds.length === 0) return;

    await notificationService.createBulk(
      adminIds,
      {
        type: 'branch_ready_to_publish',
        category: 'lifecycle',
        title: 'Branch Ready to Publish',
        message: `"${branchName}" has been approved and is ready to publish`,
        resourceType: 'branch',
        resourceId: branchId,
        actorId,
      },
      { branchId }
    );
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send ready-to-publish notification:', error);
  }
}
