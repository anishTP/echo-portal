import type { BranchComparison } from '@echo-portal/shared';
import type { ReviewResponse } from '../../services/reviewService';

interface ReviewStatusHeaderProps {
  comparison: BranchComparison;
  reviews: ReviewResponse[];
  onClose: () => void;
  displayMode: 'unified' | 'split';
  onDisplayModeChange: (mode: 'unified' | 'split') => void;
  showCommentsSidebar: boolean;
  onToggleCommentsSidebar: () => void;
  /** Automated check results (T072) */
  automatedChecks?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'running';
  }>;
}

/**
 * Header bar for the review overlay
 * Shows review status, approval progress, and view controls
 */
export function ReviewStatusHeader({
  comparison,
  reviews,
  onClose,
  displayMode,
  onDisplayModeChange,
  showCommentsSidebar,
  onToggleCommentsSidebar,
  automatedChecks,
}: ReviewStatusHeaderProps) {
  // Calculate approval progress
  const activeReviews = reviews.filter((r) => r.status !== 'cancelled');
  const approvedCount = activeReviews.filter(
    (r) => r.status === 'completed' && r.decision === 'approved'
  ).length;
  const changesRequestedCount = activeReviews.filter(
    (r) => r.status === 'completed' && r.decision === 'changes_requested'
  ).length;
  const pendingCount = activeReviews.filter(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  ).length;

  // Determine overall status
  const getStatusBadge = () => {
    if (changesRequestedCount > 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
          Changes Requested
        </span>
      );
    }
    if (approvedCount > 0 && pendingCount === 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
          Approved
        </span>
      );
    }
    if (pendingCount > 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
          Pending Review
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
        No Reviews
      </span>
    );
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-800">
      {/* Left: Branch info and status */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          title="Close review"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-gray-500">Comparing </span>
            <span className="font-mono font-medium">{comparison.headRef}</span>
            <span className="text-gray-500"> to </span>
            <span className="font-mono font-medium">{comparison.baseRef}</span>
          </div>

          {getStatusBadge()}
        </div>
      </div>

      {/* Center: Approval progress + automated checks */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">
            {approvedCount} approved
          </span>
          {changesRequestedCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-orange-600">
                {changesRequestedCount} changes requested
              </span>
            </>
          )}
          {pendingCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">
                {pendingCount} pending
              </span>
            </>
          )}
        </div>

        {/* Automated check indicators (T072) */}
        {automatedChecks && automatedChecks.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l" style={{ borderColor: 'var(--gray-6)' }}>
            {automatedChecks.map((check) => (
              <span
                key={check.name}
                title={`${check.name}: ${check.status}`}
                className="inline-flex items-center gap-1 text-xs"
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-1)',
                  background:
                    check.status === 'passed'
                      ? 'var(--green-3)'
                      : check.status === 'failed'
                        ? 'var(--red-3)'
                        : 'var(--blue-3)',
                  color:
                    check.status === 'passed'
                      ? 'var(--green-11)'
                      : check.status === 'failed'
                        ? 'var(--red-11)'
                        : 'var(--blue-11)',
                }}
              >
                {check.status === 'passed' ? '✓' : check.status === 'failed' ? '✗' : '⟳'}
                {check.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: View controls */}
      <div className="flex items-center gap-2">
        {/* Display mode toggle */}
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => onDisplayModeChange('unified')}
            className={`px-3 py-1.5 text-sm ${
              displayMode === 'unified'
                ? 'bg-gray-100 dark:bg-gray-700 font-medium'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => onDisplayModeChange('split')}
            className={`px-3 py-1.5 text-sm border-l ${
              displayMode === 'split'
                ? 'bg-gray-100 dark:bg-gray-700 font-medium'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Split
          </button>
        </div>

        {/* Comments sidebar toggle */}
        <button
          onClick={onToggleCommentsSidebar}
          className={`p-2 rounded ${
            showCommentsSidebar
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title={showCommentsSidebar ? 'Hide comments' : 'Show comments'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>

        {/* Stats */}
        <div className="flex items-center gap-2 ml-2 text-sm text-gray-500">
          <span className="text-green-600">+{comparison.stats.additions}</span>
          <span className="text-red-600">-{comparison.stats.deletions}</span>
        </div>
      </div>
    </div>
  );
}

export default ReviewStatusHeader;
