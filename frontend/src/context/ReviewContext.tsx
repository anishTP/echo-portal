import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useComparison } from '../hooks/useComparison';
import { useReviewComments } from '../hooks/useReviewComments';
import { useBranchReviews } from '../hooks/useReview';
import type {
  BranchComparison,
  FileDiff,
} from '@echo-portal/shared';
import type { ReviewResponse, ReviewComment } from '../services/reviewService';

/**
 * Review context value shape
 * Provides unified access to review state across components
 */
interface ReviewContextValue {
  // Branch and comparison data
  branchId: string;
  comparison: BranchComparison | null;
  isComparisonLoading: boolean;
  comparisonError: Error | null;

  // Review data
  reviews: ReviewResponse[];
  activeReview: ReviewResponse | null;
  isReviewsLoading: boolean;

  // Comments data
  comments: ReviewComment[];
  isCommentsLoading: boolean;
  organizedComments: ReturnType<typeof useReviewComments>['organized'];

  // UI state
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  expandedFiles: Set<string>;
  toggleFileExpanded: (path: string) => void;
  displayMode: 'unified' | 'split';
  setDisplayMode: (mode: 'unified' | 'split') => void;

  // Actions
  refreshComparison: () => Promise<void>;
  refreshReviews: () => Promise<void>;
  refreshComments: () => Promise<void>;

  // Comment mutations from hook
  addComment: ReturnType<typeof useReviewComments>['addComment'];
  replyToComment: ReturnType<typeof useReviewComments>['replyToComment'];
  updateComment: ReturnType<typeof useReviewComments>['updateComment'];
  deleteComment: ReturnType<typeof useReviewComments>['deleteComment'];
  refreshOutdated: ReturnType<typeof useReviewComments>['refreshOutdated'];
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

interface ReviewProviderProps {
  branchId: string;
  reviewId?: string; // Optional: specific review to focus on
  children: ReactNode;
}

/**
 * ReviewProvider - Centralizes review state across components
 *
 * Provides:
 * - Branch comparison data with diff
 * - All reviews for the branch
 * - Comments with threading support
 * - UI state (selected file, display mode)
 * - Mutation functions for comments
 */
export function ReviewProvider({
  branchId,
  reviewId,
  children,
}: ReviewProviderProps) {
  // Comparison query
  const {
    data: comparison,
    isLoading: isComparisonLoading,
    error: comparisonError,
    refetch: refetchComparison,
  } = useComparison(branchId);

  // Reviews query
  const {
    data: reviews = [],
    isLoading: isReviewsLoading,
    refetch: refetchReviews,
  } = useBranchReviews(branchId);

  // Determine active review (explicit or first non-completed)
  const activeReview = useMemo(() => {
    if (reviewId) {
      return reviews.find((r) => r.id === reviewId) || null;
    }
    // Find first non-completed review for the current user to work on
    return reviews.find((r) => r.status !== 'completed' && r.status !== 'cancelled') || null;
  }, [reviews, reviewId]);

  // Comments query (for active review)
  const commentsHook = useReviewComments(activeReview?.id);

  // UI state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<'unified' | 'split'>('unified');

  const toggleFileExpanded = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Refresh functions
  const refreshComparison = useCallback(async () => {
    await refetchComparison();
  }, [refetchComparison]);

  const refreshReviews = useCallback(async () => {
    await refetchReviews();
  }, [refetchReviews]);

  const refreshComments = useCallback(async () => {
    await commentsHook.refetch();
  }, [commentsHook]);

  const value: ReviewContextValue = {
    branchId,
    comparison: comparison || null,
    isComparisonLoading,
    comparisonError: comparisonError as Error | null,
    reviews,
    activeReview,
    isReviewsLoading,
    comments: commentsHook.comments,
    isCommentsLoading: commentsHook.isLoading,
    organizedComments: commentsHook.organized,
    selectedFile,
    setSelectedFile,
    expandedFiles,
    toggleFileExpanded,
    displayMode,
    setDisplayMode,
    refreshComparison,
    refreshReviews,
    refreshComments,
    addComment: commentsHook.addComment,
    replyToComment: commentsHook.replyToComment,
    updateComment: commentsHook.updateComment,
    deleteComment: commentsHook.deleteComment,
    refreshOutdated: commentsHook.refreshOutdated,
  };

  return (
    <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
  );
}

/**
 * Hook to access review context
 * Must be used within a ReviewProvider
 */
export function useReviewContext(): ReviewContextValue {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviewContext must be used within a ReviewProvider');
  }
  return context;
}

export default ReviewContext;
