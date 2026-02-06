import { db } from '../../db/index.js';
import { reviews } from '../../db/schema/reviews.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  addReviewCommentSchema,
  type AddReviewCommentInput,
  createReviewModel,
} from '../../models/review.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../api/utils/errors.js';
import type { ReviewComment } from '@echo-portal/shared';
import { ReviewStatus } from '@echo-portal/shared';
import { comparisonService } from './comparison-service.js';
import { snapshotService } from './snapshot-service.js';

export class ReviewCommentService {
  /**
   * Add a comment to a review
   */
  async addComment(
    reviewId: string,
    input: AddReviewCommentInput,
    authorId: string
  ): Promise<ReviewComment> {
    // Validate input
    const parsed = addReviewCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid comment input', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { content, path, line, side, selectedText, startOffset, endOffset } = parsed.data;

    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review can receive comments
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot add comments to a cancelled review');
    }

    // Only the reviewer or the branch owner can add comments
    // (In practice, you'd also check the branch owner via a join)
    if (review.reviewerId !== authorId && review.requestedById !== authorId) {
      throw new ForbiddenError(
        'Only the reviewer or branch owner can add comments to this review'
      );
    }

    // Create the comment
    const now = new Date().toISOString();
    const newComment: ReviewComment = {
      id: uuidv4(),
      authorId,
      content,
      path,
      line,
      side,
      selectedText,
      startOffset,
      endOffset,
      isOutdated: false,
      createdAt: now,
      updatedAt: now,
    };

    // Get existing comments and add the new one
    const existingComments = (review.comments as ReviewComment[]) || [];
    const updatedComments = [...existingComments, newComment];

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        status:
          review.status === ReviewStatus.PENDING
            ? ReviewStatus.IN_PROGRESS
            : review.status,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return newComment;
  }

  /**
   * Update a comment on a review
   */
  async updateComment(
    reviewId: string,
    commentId: string,
    content: string,
    authorId: string
  ): Promise<ReviewComment> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Comment content is required');
    }

    if (content.length > 10000) {
      throw new ValidationError('Comment must be 10000 characters or less');
    }

    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review can receive comments
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot modify comments on a cancelled review');
    }

    // Find the comment
    const existingComments = (review.comments as ReviewComment[]) || [];
    const commentIndex = existingComments.findIndex((c) => c.id === commentId);

    if (commentIndex === -1) {
      throw new NotFoundError('Comment', commentId);
    }

    const comment = existingComments[commentIndex];

    // Check author
    if (comment.authorId !== authorId) {
      throw new ForbiddenError('Only the comment author can update this comment');
    }

    // Update the comment
    const updatedComment: ReviewComment = {
      ...comment,
      content,
      updatedAt: new Date().toISOString(),
    };

    const updatedComments = [...existingComments];
    updatedComments[commentIndex] = updatedComment;

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return updatedComment;
  }

  /**
   * Delete a comment from a review
   */
  async deleteComment(
    reviewId: string,
    commentId: string,
    authorId: string
  ): Promise<void> {
    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review can receive modifications
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot modify comments on a cancelled review');
    }

    // Find the comment
    const existingComments = (review.comments as ReviewComment[]) || [];
    const comment = existingComments.find((c) => c.id === commentId);

    if (!comment) {
      throw new NotFoundError('Comment', commentId);
    }

    // Check author
    if (comment.authorId !== authorId) {
      throw new ForbiddenError('Only the comment author can delete this comment');
    }

    // Remove the comment
    const updatedComments = existingComments.filter((c) => c.id !== commentId);

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));
  }

  /**
   * Get all comments for a review
   */
  async getComments(reviewId: string): Promise<ReviewComment[]> {
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    return (review.comments as ReviewComment[]) || [];
  }

  /**
   * Get comments by file path
   */
  async getCommentsByPath(
    reviewId: string,
    path: string
  ): Promise<ReviewComment[]> {
    const comments = await this.getComments(reviewId);
    return comments.filter((c) => c.path === path);
  }

  /**
   * Get comment count for a review
   */
  async getCommentCount(reviewId: string): Promise<number> {
    const comments = await this.getComments(reviewId);
    return comments.length;
  }

  /**
   * Add a reply to an existing comment (threading)
   * Max thread depth is 2 levels (comment → reply)
   */
  async addReply(
    reviewId: string,
    parentCommentId: string,
    content: string,
    authorId: string
  ): Promise<ReviewComment> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Reply content is required');
    }

    if (content.length > 10000) {
      throw new ValidationError('Reply must be 10000 characters or less');
    }

    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review can receive comments
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot add replies to a cancelled review');
    }

    // Find the parent comment
    const existingComments = (review.comments as ReviewComment[]) || [];
    const parent = existingComments.find((c) => c.id === parentCommentId);

    if (!parent) {
      throw new NotFoundError('Comment', parentCommentId);
    }

    // Check max depth (cannot reply to a reply)
    if (parent.parentId) {
      throw new ValidationError('Cannot reply to a reply (max thread depth exceeded)');
    }

    // Create the reply
    const now = new Date().toISOString();
    const reply: ReviewComment = {
      id: uuidv4(),
      authorId,
      content,
      parentId: parentCommentId,
      isOutdated: false,
      createdAt: now,
      updatedAt: now,
    };

    // Add reply to comments array
    const updatedComments = [...existingComments, reply];

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        status:
          review.status === ReviewStatus.PENDING
            ? ReviewStatus.IN_PROGRESS
            : review.status,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return reply;
  }

  /**
   * Refresh outdated status for all comments in a review
   * Marks comments as outdated when their anchored content has changed
   *
   * Compares each anchored comment against the current diff:
   * - If the file is no longer in the diff, mark outdated
   * - If the hunk ID no longer exists, mark outdated
   * - Already outdated comments are skipped
   * - General comments (no path) are never marked outdated
   */
  async refreshOutdatedStatus(
    reviewId: string
  ): Promise<{ updatedCount: number; comments: ReviewComment[] }> {
    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    const existingComments = (review.comments as ReviewComment[]) || [];

    // Skip if no anchored comments
    const anchoredComments = existingComments.filter(
      (c) => c.path && !c.isOutdated
    );
    if (anchoredComments.length === 0) {
      return { updatedCount: 0, comments: existingComments };
    }

    // Get current branch comparison
    let currentComparison;
    try {
      currentComparison = await comparisonService.getBranchComparison(
        review.branchId
      );
    } catch {
      // If comparison fails, don't mark anything outdated
      return { updatedCount: 0, comments: existingComments };
    }

    // Build a set of current file paths and hunk IDs for quick lookup
    const currentFiles = new Set(currentComparison.files.map((f) => f.path));
    const currentHunkIds = new Set<string>();
    for (const file of currentComparison.files) {
      for (const hunk of file.hunks) {
        if (hunk.id) {
          currentHunkIds.add(hunk.id);
        }
      }
    }

    let updatedCount = 0;
    const updatedComments = existingComments.map((comment) => {
      // Skip non-anchored or already outdated comments
      if (!comment.path || comment.isOutdated) {
        return comment;
      }

      // Check if file still exists in current diff
      if (!currentFiles.has(comment.path)) {
        updatedCount++;
        return {
          ...comment,
          isOutdated: true,
          outdatedReason: 'File no longer in diff',
        };
      }

      // Check if hunk still exists (if comment has a hunk reference)
      if (comment.hunkId && !currentHunkIds.has(comment.hunkId)) {
        updatedCount++;
        return {
          ...comment,
          isOutdated: true,
          outdatedReason: 'Referenced code section changed',
        };
      }

      return comment;
    });

    // Persist if any comments were updated
    if (updatedCount > 0) {
      await db
        .update(reviews)
        .set({
          comments: updatedComments,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId));
    }

    return { updatedCount, comments: updatedComments };
  }

  /**
   * Resolve a comment (mark as addressed)
   * Only root comments can be resolved (not replies)
   * Branch author can resolve any comment; comment author can resolve their own
   */
  async resolveComment(
    reviewId: string,
    commentId: string,
    userId: string
  ): Promise<ReviewComment> {
    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review is not cancelled
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot modify comments on cancelled review');
    }

    // Find the comment
    const existingComments = (review.comments as ReviewComment[]) || [];
    const commentIndex = existingComments.findIndex((c) => c.id === commentId);

    if (commentIndex === -1) {
      throw new NotFoundError('Comment', commentId);
    }

    const comment = existingComments[commentIndex];

    // Check it's not a reply
    if (comment.parentId) {
      throw new ValidationError('Cannot resolve a reply. Resolve the parent comment instead');
    }

    // Check if already resolved
    if (comment.resolvedAt) {
      throw new ValidationError('Comment is already resolved');
    }

    // Check permission: branch author OR comment author
    if (userId !== review.requestedById && userId !== comment.authorId) {
      throw new ForbiddenError(
        'Only the branch author or comment author can resolve this comment'
      );
    }

    // Update the comment
    const now = new Date().toISOString();
    const updatedComment: ReviewComment = {
      ...comment,
      resolvedAt: now,
      resolvedBy: userId,
      updatedAt: now,
    };

    const updatedComments = [...existingComments];
    updatedComments[commentIndex] = updatedComment;

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return updatedComment;
  }

  /**
   * Unresolve a comment (mark as not addressed)
   * Only root comments can be unresolved
   * Same permission rules as resolve
   */
  async unresolveComment(
    reviewId: string,
    commentId: string,
    userId: string
  ): Promise<ReviewComment> {
    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check review is not cancelled
    if (review.status === ReviewStatus.CANCELLED) {
      throw new ValidationError('Cannot modify comments on cancelled review');
    }

    // Find the comment
    const existingComments = (review.comments as ReviewComment[]) || [];
    const commentIndex = existingComments.findIndex((c) => c.id === commentId);

    if (commentIndex === -1) {
      throw new NotFoundError('Comment', commentId);
    }

    const comment = existingComments[commentIndex];

    // Check it's not a reply
    if (comment.parentId) {
      throw new ValidationError('Cannot unresolve a reply');
    }

    // Check if not resolved
    if (!comment.resolvedAt) {
      throw new ValidationError('Comment is not resolved');
    }

    // Check permission: branch author OR comment author
    if (userId !== review.requestedById && userId !== comment.authorId) {
      throw new ForbiddenError(
        'Only the branch author or comment author can unresolve this comment'
      );
    }

    // Update the comment
    const now = new Date().toISOString();
    const updatedComment: ReviewComment = {
      ...comment,
      resolvedAt: undefined,
      resolvedBy: undefined,
      updatedAt: now,
    };

    const updatedComments = [...existingComments];
    updatedComments[commentIndex] = updatedComment;

    // Update the review
    await db
      .update(reviews)
      .set({
        comments: updatedComments,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    return updatedComment;
  }
}

// Export singleton instance
export const reviewCommentService = new ReviewCommentService();
