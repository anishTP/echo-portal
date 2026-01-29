import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { ApprovalActions } from './ApprovalActions';
import { ReviewComments } from './ReviewComments';
import type { ReviewStatusType, ReviewDecisionType } from '@echo-portal/shared';

export interface ReviewResponse {
  id: string;
  branchId: string;
  reviewerId: string;
  requestedById: string;
  status: ReviewStatusType;
  decision: ReviewDecisionType | null;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  permissions: {
    canAddComment: boolean;
    canComplete: boolean;
    canCancel: boolean;
  };
}

export interface ReviewComment {
  id: string;
  authorId: string;
  content: string;
  path?: string;
  line?: number;
  createdAt: string;
  updatedAt: string;
}

interface ReviewPanelProps {
  review: ReviewResponse;
  currentUserId: string;
  onApprove: (reviewId: string, reason?: string) => Promise<void>;
  onRequestChanges: (reviewId: string, reason: string) => Promise<void>;
  onAddComment: (reviewId: string, content: string, path?: string, line?: number) => Promise<void>;
  onCancel?: (reviewId: string) => Promise<void>;
  isSubmitting?: boolean;
}

const statusColors: Record<ReviewStatusType, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<ReviewStatusType, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const decisionColors: Record<ReviewDecisionType, string> = {
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-orange-100 text-orange-800',
};

const decisionLabels: Record<ReviewDecisionType, string> = {
  approved: 'Approved',
  changes_requested: 'Changes Requested',
};

export function ReviewPanel({
  review,
  currentUserId,
  onApprove,
  onRequestChanges,
  onAddComment,
  onCancel,
  isSubmitting = false,
}: ReviewPanelProps) {
  const [showCommentForm, setShowCommentForm] = useState(false);

  const isReviewer = currentUserId === review.reviewerId;
  const canTakeAction = isReviewer && review.permissions.canComplete;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900">Review</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[review.status]}`}
            >
              {statusLabels[review.status]}
            </span>
            {review.decision && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${decisionColors[review.decision]}`}
              >
                {decisionLabels[review.decision]}
              </span>
            )}
          </div>

          {review.permissions.canCancel && onCancel && (
            <Button
              variant="ghost"
              size="2"
              onClick={() => onCancel(review.id)}
              disabled={isSubmitting}
            >
              Cancel Review
            </Button>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-500">
          <p>Requested: {formatDate(review.createdAt)}</p>
          {review.completedAt && <p>Completed: {formatDate(review.completedAt)}</p>}
        </div>
      </div>

      {/* Comments Section */}
      <div className="p-4">
        <ReviewComments
          comments={review.comments}
          currentUserId={currentUserId}
          canAddComment={review.permissions.canAddComment}
          onAddComment={(content, path, line) => onAddComment(review.id, content, path, line)}
          showCommentForm={showCommentForm}
          onToggleCommentForm={() => setShowCommentForm(!showCommentForm)}
        />
      </div>

      {/* Actions */}
      {canTakeAction && (
        <div className="border-t border-gray-200 p-4">
          <ApprovalActions
            onApprove={(reason) => onApprove(review.id, reason)}
            onRequestChanges={(reason) => onRequestChanges(review.id, reason)}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  );
}

export default ReviewPanel;
