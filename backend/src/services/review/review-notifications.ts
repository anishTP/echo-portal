import { db } from '../../db/index.js';
import { notifications } from '../../db/schema/notifications.js';
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
    await db.insert(notifications).values({
      userId: review.reviewerId,
      type: ReviewNotificationType.REVIEW_REQUESTED,
      title: 'Review Requested',
      message: `You have been requested to review "${branchName}"`,
      resourceType: 'review',
      resourceId: review.id,
    });
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
    // Filter out the comment author from recipients
    const filteredRecipients = recipientIds.filter((id) => id !== comment.authorId);

    if (filteredRecipients.length === 0) return;

    const notificationValues = filteredRecipients.map((userId) => ({
      userId,
      type: ReviewNotificationType.REVIEW_COMMENT_ADDED,
      title: 'New Review Comment',
      message: 'A new comment was added to a review you\'re participating in',
      resourceType: 'review' as const,
      resourceId: review.id,
    }));

    await db.insert(notifications).values(notificationValues);
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
  parentCommentAuthorId: string
): Promise<void> {
  try {
    // Don't notify if replying to own comment
    if (reply.authorId === parentCommentAuthorId) return;

    await db.insert(notifications).values({
      userId: parentCommentAuthorId,
      type: ReviewNotificationType.REVIEW_COMMENT_REPLY,
      title: 'Reply to Your Comment',
      message: 'Someone replied to your comment on a review',
      resourceType: 'review',
      resourceId: review.id,
    });
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
    await db.insert(notifications).values({
      userId: review.requestedById,
      type: ReviewNotificationType.REVIEW_APPROVED,
      title: 'Review Approved',
      message: `Your branch "${branchName}" has been approved`,
      resourceType: 'review',
      resourceId: review.id,
    });
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
    await db.insert(notifications).values({
      userId: review.requestedById,
      type: ReviewNotificationType.REVIEW_CHANGES_REQUESTED,
      title: 'Changes Requested',
      message: `Changes have been requested on "${branchName}"${reason ? `: ${reason.slice(0, 100)}` : ''}`,
      resourceType: 'review',
      resourceId: review.id,
    });
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
  _addedById: string
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: reviewerId,
      type: ReviewNotificationType.REVIEWER_ADDED,
      title: 'Added as Reviewer',
      message: `You have been added as a reviewer to "${branchName}"`,
      resourceType: 'branch',
      resourceId: branchId,
    });
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
  _removedById: string
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: reviewerId,
      type: ReviewNotificationType.REVIEWER_REMOVED,
      title: 'Removed from Review',
      message: `You have been removed as a reviewer from "${branchName}"`,
      resourceType: 'branch',
      resourceId: branchId,
    });
  } catch (error) {
    console.error('[ReviewNotifications] Failed to send reviewer removed notification:', error);
  }
}
