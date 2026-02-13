import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so NO outer-scope variable references
// ---------------------------------------------------------------------------

// Mock notificationService with a spy for createBulk
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock @echo-portal/shared for ReviewComment type (and any other imports)
vi.mock('@echo-portal/shared', () => ({}));

// ---------------------------------------------------------------------------
// Imports — AFTER all vi.mock calls so hoisting resolves correctly
// ---------------------------------------------------------------------------

import { notificationService } from '../../src/services/notification/notification-service';
import {
  ReviewNotificationType,
  notifyReviewSubmitted,
  notifyCommentAdded,
  notifyCommentReply,
  notifyReviewApproved,
  notifyChangesRequested,
  notifyReviewerAdded,
  notifyReviewerRemoved,
} from '../../src/services/review/review-notifications';

// ---------------------------------------------------------------------------
// Test IDs — valid UUID format
// ---------------------------------------------------------------------------

const REVIEW_ID = '00000000-0000-4000-a000-000000000001';
const BRANCH_ID = '00000000-0000-4000-b000-000000000001';
const REVIEWER_ID = '00000000-0000-4000-a000-000000000002';
const REQUESTER_ID = '00000000-0000-4000-a000-000000000003';
const COMMENT_AUTHOR_ID = '00000000-0000-4000-a000-000000000004';
const REPLY_AUTHOR_ID = '00000000-0000-4000-a000-000000000005';
const ADDED_BY_ID = '00000000-0000-4000-a000-000000000006';
const REMOVED_BY_ID = '00000000-0000-4000-a000-000000000007';
const RECIPIENT_A = '00000000-0000-4000-a000-000000000010';
const RECIPIENT_B = '00000000-0000-4000-a000-000000000011';
const PARTICIPANT_A = '00000000-0000-4000-a000-000000000020';
const PARTICIPANT_B = '00000000-0000-4000-a000-000000000021';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard review object used by most notification functions */
function makeReview(overrides: Record<string, string> = {}) {
  return {
    id: REVIEW_ID,
    branchId: BRANCH_ID,
    reviewerId: REVIEWER_ID,
    requestedById: REQUESTER_ID,
    ...overrides,
  };
}

/** Minimal ReviewComment shape for testing */
function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-c000-000000000001',
    authorId: COMMENT_AUTHOR_ID,
    content: 'Looks good overall.',
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
    ...overrides,
  } as any;
}

/** Minimal reply comment shape */
function makeReply(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-c000-000000000002',
    authorId: REPLY_AUTHOR_ID,
    content: 'Thanks for the feedback.',
    parentId: '00000000-0000-4000-c000-000000000001',
    createdAt: '2026-01-20T01:00:00Z',
    updatedAt: '2026-01-20T01:00:00Z',
    ...overrides,
  } as any;
}

const BRANCH_NAME = 'feature/new-widget';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('review-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // ReviewNotificationType constants
  // =========================================================================
  describe('ReviewNotificationType', () => {
    it('defines all 7 expected event types', () => {
      expect(ReviewNotificationType.REVIEW_REQUESTED).toBe('review_requested');
      expect(ReviewNotificationType.REVIEW_COMMENT_ADDED).toBe('review_comment_added');
      expect(ReviewNotificationType.REVIEW_COMMENT_REPLY).toBe('review_comment_reply');
      expect(ReviewNotificationType.REVIEW_APPROVED).toBe('review_approved');
      expect(ReviewNotificationType.REVIEW_CHANGES_REQUESTED).toBe('review_changes_requested');
      expect(ReviewNotificationType.REVIEWER_ADDED).toBe('reviewer_added');
      expect(ReviewNotificationType.REVIEWER_REMOVED).toBe('reviewer_removed');
    });
  });

  // =========================================================================
  // notifyReviewSubmitted
  // =========================================================================
  describe('notifyReviewSubmitted()', () => {
    it('calls createBulk with correct params for review_requested', async () => {
      const review = makeReview();

      await notifyReviewSubmitted(review, BRANCH_NAME);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [REVIEWER_ID],
        {
          type: 'review_requested',
          category: 'review',
          title: 'Review Requested',
          message: `You have been requested to review "${BRANCH_NAME}"`,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: REQUESTER_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      await notifyReviewSubmitted(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (requestedById)', async () => {
      await notifyReviewSubmitted(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(REQUESTER_ID);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyReviewSubmitted(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('DB connection failed');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(notifyReviewSubmitted(makeReview(), BRANCH_NAME)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send review requested notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyCommentAdded
  // =========================================================================
  describe('notifyCommentAdded()', () => {
    it('calls createBulk with correct params for review_comment_added', async () => {
      const review = makeReview();
      const comment = makeComment();
      const recipients = [RECIPIENT_A, RECIPIENT_B];

      await notifyCommentAdded(review, comment, recipients);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [RECIPIENT_A, RECIPIENT_B],
        {
          type: 'review_comment_added',
          category: 'review',
          title: 'New Review Comment',
          message: "A new comment was added to a review you're participating in",
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: COMMENT_AUTHOR_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      await notifyCommentAdded(makeReview(), makeComment(), [RECIPIENT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (comment.authorId)', async () => {
      const customAuthor = '00000000-0000-4000-a000-000000000099';
      const comment = makeComment({ authorId: customAuthor });

      await notifyCommentAdded(makeReview(), comment, [RECIPIENT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(customAuthor);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyCommentAdded(makeReview(), makeComment(), [RECIPIENT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('Insert failed');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(notifyCommentAdded(makeReview(), makeComment(), [RECIPIENT_A])).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send comment notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyCommentReply
  // =========================================================================
  describe('notifyCommentReply()', () => {
    it('calls createBulk with correct params for review_comment_reply', async () => {
      const review = { id: REVIEW_ID, branchId: BRANCH_ID };
      const reply = makeReply();
      const participants = [PARTICIPANT_A, PARTICIPANT_B];

      await notifyCommentReply(review, reply, participants);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [PARTICIPANT_A, PARTICIPANT_B],
        {
          type: 'review_comment_reply',
          category: 'review',
          title: 'Reply to Comment',
          message: "Someone replied to a comment thread you're participating in",
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: REPLY_AUTHOR_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      const review = { id: REVIEW_ID, branchId: BRANCH_ID };
      await notifyCommentReply(review, makeReply(), [PARTICIPANT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (reply.authorId)', async () => {
      const customAuthor = '00000000-0000-4000-a000-000000000088';
      const review = { id: REVIEW_ID, branchId: BRANCH_ID };
      const reply = makeReply({ authorId: customAuthor });

      await notifyCommentReply(review, reply, [PARTICIPANT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(customAuthor);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      const review = { id: REVIEW_ID, branchId: BRANCH_ID };
      await notifyCommentReply(review, makeReply(), [PARTICIPANT_A]);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('Network error');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const review = { id: REVIEW_ID, branchId: BRANCH_ID };
      await expect(notifyCommentReply(review, makeReply(), [PARTICIPANT_A])).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send reply notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyReviewApproved
  // =========================================================================
  describe('notifyReviewApproved()', () => {
    it('calls createBulk with correct params for review_approved', async () => {
      const review = makeReview();

      await notifyReviewApproved(review, BRANCH_NAME);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [REQUESTER_ID],
        {
          type: 'review_approved',
          category: 'review',
          title: 'Review Approved',
          message: `Your branch "${BRANCH_NAME}" has been approved`,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: REVIEWER_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      await notifyReviewApproved(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (reviewerId)', async () => {
      await notifyReviewApproved(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(REVIEWER_ID);
    });

    it('notifies requestedById (branch owner), not the reviewer', async () => {
      await notifyReviewApproved(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toEqual([REQUESTER_ID]);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyReviewApproved(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('Timeout');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(notifyReviewApproved(makeReview(), BRANCH_NAME)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send approval notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyChangesRequested
  // =========================================================================
  describe('notifyChangesRequested()', () => {
    it('calls createBulk with correct params for review_changes_requested (no reason)', async () => {
      const review = makeReview();

      await notifyChangesRequested(review, BRANCH_NAME);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [REQUESTER_ID],
        {
          type: 'review_changes_requested',
          category: 'review',
          title: 'Changes Requested',
          message: `Changes have been requested on "${BRANCH_NAME}"`,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: REVIEWER_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('includes reason in message when provided', async () => {
      const reason = 'Missing error handling in the save function';

      await notifyChangesRequested(makeReview(), BRANCH_NAME, reason);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].message).toBe(
        `Changes have been requested on "${BRANCH_NAME}": ${reason}`,
      );
    });

    it('truncates reason to 100 characters', async () => {
      const longReason = 'A'.repeat(150);

      await notifyChangesRequested(makeReview(), BRANCH_NAME, longReason);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      const expectedTruncated = longReason.slice(0, 100);
      expect(callArgs[1].message).toBe(
        `Changes have been requested on "${BRANCH_NAME}": ${expectedTruncated}`,
      );
    });

    it('passes category: review', async () => {
      await notifyChangesRequested(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (reviewerId)', async () => {
      await notifyChangesRequested(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(REVIEWER_ID);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyChangesRequested(makeReview(), BRANCH_NAME);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('Permission denied');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(notifyChangesRequested(makeReview(), BRANCH_NAME)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send changes requested notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyReviewerAdded
  // =========================================================================
  describe('notifyReviewerAdded()', () => {
    it('calls createBulk with correct params for reviewer_added', async () => {
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [REVIEWER_ID],
        {
          type: 'reviewer_added',
          category: 'review',
          title: 'Added as Reviewer',
          message: `You have been added as a reviewer to "${BRANCH_NAME}"`,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: ADDED_BY_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (addedById)', async () => {
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(ADDED_BY_ID);
    });

    it('uses resourceType: branch (not review)', async () => {
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].resourceType).toBe('branch');
      expect(callArgs[1].resourceId).toBe(BRANCH_ID);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('SSE publish failed');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send reviewer added notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // notifyReviewerRemoved
  // =========================================================================
  describe('notifyReviewerRemoved()', () => {
    it('calls createBulk with correct params for reviewer_removed', async () => {
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [REVIEWER_ID],
        {
          type: 'reviewer_removed',
          category: 'review',
          title: 'Removed from Review',
          message: `You have been removed as a reviewer from "${BRANCH_NAME}"`,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: REMOVED_BY_ID,
        },
        { branchId: BRANCH_ID },
      );
    });

    it('passes category: review', async () => {
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].category).toBe('review');
    });

    it('passes correct actorId (removedById)', async () => {
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].actorId).toBe(REMOVED_BY_ID);
    });

    it('uses resourceType: branch (not review)', async () => {
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].resourceType).toBe('branch');
      expect(callArgs[1].resourceId).toBe(BRANCH_ID);
    });

    it('passes branchId for self-suppression via resolveRecipients', async () => {
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      const callArgs = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('does not propagate errors and calls console.error on failure', async () => {
      const error = new Error('Unexpected failure');
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNotifications] Failed to send reviewer removed notification:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // Cross-cutting: all 7 event types share review category
  // =========================================================================
  describe('all event types use category: review', () => {
    it('every notification function passes category review to createBulk', async () => {
      const review = makeReview();
      const reviewMinimal = { id: REVIEW_ID, branchId: BRANCH_ID };

      // Call all 7 functions
      await notifyReviewSubmitted(review, BRANCH_NAME);
      await notifyCommentAdded(review, makeComment(), [RECIPIENT_A]);
      await notifyCommentReply(reviewMinimal, makeReply(), [PARTICIPANT_A]);
      await notifyReviewApproved(review, BRANCH_NAME);
      await notifyChangesRequested(review, BRANCH_NAME);
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(7);

      const calls = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[1].category).toBe('review');
      }
    });
  });

  // =========================================================================
  // Cross-cutting: all 7 pass branchId in options
  // =========================================================================
  describe('all event types pass branchId for self-suppression', () => {
    it('every notification function passes branchId in the options argument', async () => {
      const review = makeReview();
      const reviewMinimal = { id: REVIEW_ID, branchId: BRANCH_ID };

      await notifyReviewSubmitted(review, BRANCH_NAME);
      await notifyCommentAdded(review, makeComment(), [RECIPIENT_A]);
      await notifyCommentReply(reviewMinimal, makeReply(), [PARTICIPANT_A]);
      await notifyReviewApproved(review, BRANCH_NAME);
      await notifyChangesRequested(review, BRANCH_NAME);
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      expect(notificationService.createBulk).toHaveBeenCalledTimes(7);

      const calls = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[2]).toEqual({ branchId: BRANCH_ID });
      }
    });
  });

  // =========================================================================
  // Cross-cutting: all 7 pass correct actorId
  // =========================================================================
  describe('all event types pass correct actorId', () => {
    it('each function maps actorId from the correct source field', async () => {
      const review = makeReview();
      const reviewMinimal = { id: REVIEW_ID, branchId: BRANCH_ID };

      await notifyReviewSubmitted(review, BRANCH_NAME);
      await notifyCommentAdded(review, makeComment(), [RECIPIENT_A]);
      await notifyCommentReply(reviewMinimal, makeReply(), [PARTICIPANT_A]);
      await notifyReviewApproved(review, BRANCH_NAME);
      await notifyChangesRequested(review, BRANCH_NAME);
      await notifyReviewerAdded(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, ADDED_BY_ID);
      await notifyReviewerRemoved(BRANCH_ID, REVIEWER_ID, BRANCH_NAME, REMOVED_BY_ID);

      const calls = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls;

      // notifyReviewSubmitted: actorId = requestedById
      expect(calls[0][1].actorId).toBe(REQUESTER_ID);
      // notifyCommentAdded: actorId = comment.authorId
      expect(calls[1][1].actorId).toBe(COMMENT_AUTHOR_ID);
      // notifyCommentReply: actorId = reply.authorId
      expect(calls[2][1].actorId).toBe(REPLY_AUTHOR_ID);
      // notifyReviewApproved: actorId = reviewerId
      expect(calls[3][1].actorId).toBe(REVIEWER_ID);
      // notifyChangesRequested: actorId = reviewerId
      expect(calls[4][1].actorId).toBe(REVIEWER_ID);
      // notifyReviewerAdded: actorId = addedById
      expect(calls[5][1].actorId).toBe(ADDED_BY_ID);
      // notifyReviewerRemoved: actorId = removedById
      expect(calls[6][1].actorId).toBe(REMOVED_BY_ID);
    });
  });
});
