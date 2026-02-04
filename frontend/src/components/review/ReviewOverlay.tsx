import { useState, useCallback, useMemo } from 'react';
import { useReviewContext } from '../../context/ReviewContext';
import { DiffView } from './DiffView';
import { ReviewStatusHeader } from './ReviewStatusHeader';
import { useReviewKeyboardShortcuts } from '../../hooks/useReviewKeyboardShortcuts';

interface ReviewOverlayProps {
  branchId: string;
  onClose: () => void;
}

/**
 * Full-screen overlay for in-context review
 * Contains the diff view, comments sidebar, and decision panel
 */
export function ReviewOverlay({ branchId: _branchId, onClose }: ReviewOverlayProps) {
  const {
    comparison,
    isComparisonLoading,
    comparisonError,
    reviews,
    activeReview,
    comments,
    displayMode,
    setDisplayMode,
    addComment,
  } = useReviewContext();

  const [showCommentsSidebar, setShowCommentsSidebar] = useState(true);

  // File navigation helpers
  const fileList = useMemo(
    () => comparison?.files.map((f) => f.path) ?? [],
    [comparison]
  );

  const { selectedFile, setSelectedFile, expandedFiles, toggleFileExpanded } = useReviewContext();

  const handleNextFile = useCallback(() => {
    if (fileList.length === 0) return;
    const currentIndex = selectedFile ? fileList.indexOf(selectedFile) : -1;
    const nextIndex = (currentIndex + 1) % fileList.length;
    const nextFile = fileList[nextIndex];
    setSelectedFile(nextFile);
    if (!expandedFiles.has(nextFile)) {
      toggleFileExpanded(nextFile);
    }
  }, [fileList, selectedFile, setSelectedFile, expandedFiles, toggleFileExpanded]);

  const handlePrevFile = useCallback(() => {
    if (fileList.length === 0) return;
    const currentIndex = selectedFile ? fileList.indexOf(selectedFile) : 0;
    const prevIndex = (currentIndex - 1 + fileList.length) % fileList.length;
    const prevFile = fileList[prevIndex];
    setSelectedFile(prevFile);
    if (!expandedFiles.has(prevFile)) {
      toggleFileExpanded(prevFile);
    }
  }, [fileList, selectedFile, setSelectedFile, expandedFiles, toggleFileExpanded]);

  // Keyboard shortcuts
  useReviewKeyboardShortcuts({
    onClose,
    onToggleComments: () => setShowCommentsSidebar((prev) => !prev),
    onToggleDisplayMode: () =>
      setDisplayMode(displayMode === 'unified' ? 'split' : 'unified'),
    onNextFile: handleNextFile,
    onPrevFile: handlePrevFile,
    enabled: true,
  });

  const handleAddComment = useCallback(
    async (path: string, line: number, side: 'old' | 'new', content: string) => {
      if (!activeReview) return;
      await addComment.mutateAsync({
        content,
        path,
        line,
        side,
      });
    },
    [activeReview, addComment]
  );

  // Loading state
  if (isComparisonLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading comparison...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (comparisonError || !comparison) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg
            className="w-16 h-16 text-red-500 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Failed to load comparison
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {comparisonError?.message || 'Unable to load the branch comparison.'}
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Review overlay"
    >
      {/* Header */}
      <ReviewStatusHeader
        comparison={comparison}
        reviews={reviews}
        onClose={onClose}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        showCommentsSidebar={showCommentsSidebar}
        onToggleCommentsSidebar={() => setShowCommentsSidebar(!showCommentsSidebar)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diff view */}
        <div className="flex-1 overflow-auto p-4">
          <DiffView
            comparison={comparison}
            comments={comments}
            onAddComment={activeReview ? handleAddComment : undefined}
            displayMode={displayMode}
          />
        </div>

        {/* Comments sidebar */}
        {showCommentsSidebar && (
          <div className="w-80 border-l bg-gray-50 dark:bg-gray-800 overflow-y-auto" role="complementary" aria-label="Review comments">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Comments ({comments.length})
              </h3>

              {comments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No comments yet. Click on a line in the diff to add a comment.
                </p>
              ) : (
                <div className="space-y-4">
                  {comments
                    .filter((c) => !c.parentId) // Only show top-level comments
                    .map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-md ${
                          comment.isOutdated
                            ? 'bg-gray-100 dark:bg-gray-700 opacity-60'
                            : 'bg-white dark:bg-gray-900'
                        } border`}
                      >
                        {comment.isOutdated && (
                          <span className="text-xs text-orange-600 font-medium">
                            Outdated
                          </span>
                        )}
                        {comment.path && (
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {comment.path}:{comment.line}
                          </div>
                        )}
                        <p className="text-sm mt-1">{comment.content}</p>
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>

                        {/* Replies */}
                        {comments
                          .filter((r) => r.parentId === comment.id)
                          .map((reply) => (
                            <div
                              key={reply.id}
                              className="mt-2 ml-3 pl-3 border-l-2 border-gray-200"
                            >
                              <p className="text-sm">{reply.content}</p>
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(reply.createdAt).toLocaleString()}
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decision panel */}
      {activeReview && (
        <div className="border-t p-4 bg-gray-50 dark:bg-gray-800" role="toolbar" aria-label="Review actions">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Review by: You
            </div>
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Request changes on this review"
              >
                Request Changes
              </button>
              <button
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                aria-label="Approve this review"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewOverlay;
