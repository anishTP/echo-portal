import { useMemo, useRef, useEffect } from 'react';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService, type ReviewComment, type ReviewResponse } from '../services/reviewService';
import { useUIStore } from '../stores/index';
import { reviewKeys } from './queryKeys';

/**
 * Hook to aggregate and manage comments from ALL reviews on a branch.
 *
 * This solves the visibility issue where comments were only visible to the person
 * who wrote them because each user was fetching from a different review object.
 *
 * Now we:
 * 1. Fetch comments from ALL reviews on the branch in parallel
 * 2. Merge them into a single array with reviewId preserved
 * 3. Use reviewId on each comment to route mutations to the correct review
 */
export function useBranchComments(
  _branchId: string | undefined,
  reviews: ReviewResponse[] | undefined,
  currentUserId: string | undefined
) {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  // Get all review IDs for this branch
  const reviewIds = useMemo(() => {
    if (!reviews) return [];
    return reviews.map(r => r.id);
  }, [reviews]);

  // Fetch comments from all reviews in parallel
  const commentQueries = useQueries({
    queries: reviewIds.map(reviewId => ({
      queryKey: reviewKeys.comments(reviewId),
      queryFn: async (): Promise<ReviewComment[]> => {
        return reviewService.getComments(reviewId);
      },
      enabled: !!reviewId,
    })),
  });

  // Merge all comments into a single array
  const comments = useMemo(() => {
    const allComments: ReviewComment[] = [];
    for (const query of commentQueries) {
      if (query.data) {
        allComments.push(...query.data);
      }
    }
    // Sort by creation time
    return allComments.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [commentQueries]);

  // Keep a ref to the latest comments for use in mutation closures
  // This avoids stale closure issues where mutations capture old comments array
  const commentsRef = useRef<ReviewComment[]>(comments);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Loading state: true if any query is loading
  const isLoading = commentQueries.some(q => q.isLoading);

  // Error state: first error found
  const error = commentQueries.find(q => q.error)?.error ?? null;

  // Find the user's own review for adding new comments
  // (user is either the reviewer or the branch author)
  const userReview = useMemo(() => {
    if (!reviews || !currentUserId) return null;
    // First, try to find a review where user is the reviewer
    const asReviewer = reviews.find(
      r => r.reviewerId === currentUserId && (r.status === 'pending' || r.status === 'in_progress')
    );
    if (asReviewer) return asReviewer;
    // If not a reviewer, find any active review (user must be the branch author replying)
    return reviews.find(r => r.status === 'pending' || r.status === 'in_progress') ?? null;
  }, [reviews, currentUserId]);

  // Invalidate all comment queries for this branch
  const invalidateAllComments = () => {
    for (const reviewId of reviewIds) {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId) });
    }
  };

  // Add comment mutation (adds to user's own review)
  const addComment = useMutation({
    mutationFn: ({
      content,
      path,
      line,
      // hunkId is kept in the interface for future use but not passed to API yet
      hunkId: _,
      side,
      selectedText,
      startOffset,
      endOffset,
    }: {
      content: string;
      path?: string;
      line?: number;
      hunkId?: string;
      side?: 'old' | 'new';
      selectedText?: string;
      startOffset?: number;
      endOffset?: number;
    }) => {
      void _; // Suppress unused variable warning
      if (!userReview) throw new Error('No active review to add comment to');
      return reviewService.addComment(userReview.id, content, path, line, {
        side,
        selectedText,
        startOffset,
        endOffset,
      });
    },
    onSuccess: () => {
      invalidateAllComments();
      if (userReview) {
        queryClient.invalidateQueries({ queryKey: reviewKeys.detail(userReview.id) });
      }
      addNotification({
        type: 'success',
        title: 'Comment added',
        message: 'Your comment has been posted.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to add comment',
        message: error.message,
      });
    },
  });

  // Reply to comment mutation (uses comment's reviewId)
  const replyToComment = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => {
      // Find the comment to get its reviewId (use ref for latest data)
      const comment = commentsRef.current.find(c => c.id === commentId);
      if (!comment?.reviewId) {
        throw new Error('Cannot find review for this comment');
      }
      return reviewService.replyToComment(comment.reviewId, commentId, content);
    },
    onSuccess: () => {
      invalidateAllComments();
      addNotification({
        type: 'success',
        title: 'Reply added',
        message: 'Your reply has been posted.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to add reply',
        message: error.message,
      });
    },
  });

  // Update comment mutation (uses comment's reviewId)
  const updateComment = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => {
      const comment = commentsRef.current.find(c => c.id === commentId);
      if (!comment?.reviewId) {
        throw new Error('Cannot find review for this comment');
      }
      return reviewService.updateComment(comment.reviewId, commentId, content);
    },
    onSuccess: () => {
      invalidateAllComments();
      addNotification({
        type: 'success',
        title: 'Comment updated',
        message: 'Your comment has been updated.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to update comment',
        message: error.message,
      });
    },
  });

  // Delete comment mutation (uses comment's reviewId)
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => {
      const comment = commentsRef.current.find(c => c.id === commentId);
      if (!comment?.reviewId) {
        throw new Error('Cannot find review for this comment');
      }
      return reviewService.deleteComment(comment.reviewId, commentId);
    },
    onSuccess: () => {
      invalidateAllComments();
      addNotification({
        type: 'success',
        title: 'Comment deleted',
        message: 'Your comment has been deleted.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to delete comment',
        message: error.message,
      });
    },
  });

  // Resolve comment mutation (uses comment's reviewId)
  const resolveComment = useMutation({
    mutationFn: (commentId: string) => {
      const comment = commentsRef.current.find(c => c.id === commentId);
      if (!comment?.reviewId) {
        throw new Error('Cannot find review for this comment');
      }
      return reviewService.resolveComment(comment.reviewId, commentId);
    },
    onSuccess: () => {
      invalidateAllComments();
      addNotification({
        type: 'success',
        title: 'Comment resolved',
        message: 'The comment has been marked as resolved.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to resolve comment',
        message: error.message,
      });
    },
  });

  // Unresolve comment mutation (uses comment's reviewId)
  const unresolveComment = useMutation({
    mutationFn: (commentId: string) => {
      const comment = commentsRef.current.find(c => c.id === commentId);
      if (!comment?.reviewId) {
        throw new Error('Cannot find review for this comment');
      }
      return reviewService.unresolveComment(comment.reviewId, commentId);
    },
    onSuccess: () => {
      invalidateAllComments();
      addNotification({
        type: 'success',
        title: 'Comment unresolved',
        message: 'The comment has been marked as unresolved.',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to unresolve comment',
        message: error.message,
      });
    },
  });

  // Helper to organize comments by file and thread
  const organizeComments = (commentList: ReviewComment[]) => {
    const byFile: Record<string, ReviewComment[]> = {};
    const general: ReviewComment[] = [];
    const threaded: Map<string, ReviewComment[]> = new Map();

    // First pass: organize by file and identify root comments
    for (const comment of commentList) {
      if (comment.parentId) {
        // This is a reply
        if (!threaded.has(comment.parentId)) {
          threaded.set(comment.parentId, []);
        }
        threaded.get(comment.parentId)!.push(comment);
      } else if (comment.path) {
        // Root comment on a file
        if (!byFile[comment.path]) {
          byFile[comment.path] = [];
        }
        byFile[comment.path].push(comment);
      } else {
        // General comment
        general.push(comment);
      }
    }

    return {
      byFile,
      general,
      getReplies: (commentId: string) => threaded.get(commentId) || [],
      outdatedCount: commentList.filter((c) => c.isOutdated).length,
      resolvedCount: commentList.filter((c) => c.resolvedAt && !c.parentId).length,
      unresolvedCount: commentList.filter((c) => !c.resolvedAt && !c.parentId).length,
      totalCount: commentList.length,
    };
  };

  // Refetch all comments
  const refetch = () => {
    for (const query of commentQueries) {
      query.refetch();
    }
  };

  return {
    comments,
    isLoading,
    error,
    organized: comments.length > 0 ? organizeComments(comments) : null,
    addComment,
    replyToComment,
    updateComment,
    deleteComment,
    resolveComment,
    unresolveComment,
    refetch,
    // Expose the user's review for determining if they can add comments
    userReview,
  };
}

export default useBranchComments;
