import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService, type ReviewComment } from '../services/reviewService';
import { useUIStore } from '../stores/index';
import { reviewKeys } from './queryKeys';

/**
 * Hook to fetch and manage review comments with threading support
 */
export function useReviewComments(reviewId: string | undefined) {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);

  // Fetch comments
  const commentsQuery = useQuery({
    queryKey: reviewKeys.comments(reviewId || ''),
    queryFn: async (): Promise<ReviewComment[]> => {
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.getComments(reviewId);
    },
    enabled: !!reviewId,
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: ({
      content,
      path,
      line,
      hunkId: _hunkId, // Currently not passed to API, but kept for future use
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
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.addComment(reviewId, content, path, line, {
        side,
        selectedText,
        startOffset,
        endOffset,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId!) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(reviewId!) });
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

  // Reply to comment mutation
  const replyToComment = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => {
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.replyToComment(reviewId, commentId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId!) });
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

  // Update comment mutation
  const updateComment = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => {
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.updateComment(reviewId, commentId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId!) });
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

  // Delete comment mutation
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => {
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.deleteComment(reviewId, commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId!) });
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

  // Refresh outdated status mutation
  const refreshOutdated = useMutation({
    mutationFn: () => {
      if (!reviewId) throw new Error('Review ID required');
      return reviewService.refreshComments(reviewId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.comments(reviewId!) });
      if (data.updatedCount > 0) {
        addNotification({
          type: 'info',
          title: 'Comments refreshed',
          message: `${data.updatedCount} comment(s) marked as outdated.`,
        });
      }
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        title: 'Failed to refresh comments',
        message: error.message,
      });
    },
  });

  // Helper to organize comments by file and thread
  const organizeComments = (comments: ReviewComment[]) => {
    const byFile: Record<string, ReviewComment[]> = {};
    const general: ReviewComment[] = [];
    const threaded: Map<string, ReviewComment[]> = new Map();

    // First pass: organize by file and identify root comments
    for (const comment of comments) {
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
      outdatedCount: comments.filter((c) => c.isOutdated).length,
      totalCount: comments.length,
    };
  };

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    organized: commentsQuery.data ? organizeComments(commentsQuery.data) : null,
    addComment,
    replyToComment,
    updateComment,
    deleteComment,
    refreshOutdated,
    refetch: commentsQuery.refetch,
  };
}

export default useReviewComments;
