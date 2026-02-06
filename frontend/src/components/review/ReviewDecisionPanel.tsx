import { useState } from 'react';
import type { ReviewResponse } from '../../services/reviewService';
import { RequestChangesDialog } from './RequestChangesDialog';

interface ReviewDecisionPanelProps {
  review: ReviewResponse;
  currentUserId: string;
  onApprove: (reason?: string) => Promise<void>;
  onRequestChanges: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Panel for making review decisions (approve or request changes)
 * Shows appropriate actions based on reviewer status
 */
export function ReviewDecisionPanel({
  review,
  currentUserId,
  onApprove,
  onRequestChanges,
  isSubmitting = false,
}: ReviewDecisionPanelProps) {
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  const isReviewer = review.reviewerId === currentUserId;
  const canDecide =
    isReviewer &&
    (review.status === 'pending' || review.status === 'in_progress');
  const hasDecided = review.status === 'completed';

  // If user is not the reviewer or review is not actionable
  if (!isReviewer) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t">
        <p className="text-sm text-gray-500 text-center">
          You are not assigned as a reviewer for this branch.
        </p>
      </div>
    );
  }

  // If reviewer has already made a decision
  if (hasDecided) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t">
        <div className="flex items-center justify-center gap-2">
          {review.decision === 'approved' ? (
            <>
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-green-600 font-medium">You approved this review</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 text-orange-600"
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
              <span className="text-orange-600 font-medium">
                You requested changes on this review
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Active decision panel
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Submit your review</h3>
            <p className="text-sm text-gray-500 mt-1">
              Review the changes and provide your decision
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRequestChanges(true)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm border border-orange-300 text-orange-700 rounded-md hover:bg-orange-50 disabled:opacity-50"
            >
              Request Changes
            </button>

            {showApprovalForm ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Optional comment..."
                  className="px-3 py-2 text-sm border rounded-md w-48"
                />
                <button
                  onClick={async () => {
                    await onApprove(approvalReason || undefined);
                    setShowApprovalForm(false);
                    setApprovalReason('');
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowApprovalForm(false);
                    setApprovalReason('');
                  }}
                  className="px-2 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowApprovalForm(true)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      </div>

      <RequestChangesDialog
        isOpen={showRequestChanges}
        onClose={() => setShowRequestChanges(false)}
        onSubmit={onRequestChanges}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

export default ReviewDecisionPanel;
