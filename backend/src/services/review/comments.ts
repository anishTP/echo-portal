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

    const { content, path, line } = parsed.data;

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
}

// Export singleton instance
export const reviewCommentService = new ReviewCommentService();
