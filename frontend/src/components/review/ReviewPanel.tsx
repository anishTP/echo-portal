import { useState } from 'react';
import { Button, Badge } from '@radix-ui/themes';
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
  authorName?: string;
  authorAvatarUrl?: string;
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

const statusBadgeColors: Record<ReviewStatusType, 'yellow' | 'blue' | 'green' | 'gray'> = {
  pending: 'yellow',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'gray',
};

const statusLabels: Record<ReviewStatusType, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const decisionBadgeColors: Record<ReviewDecisionType, 'green' | 'orange'> = {
  approved: 'green',
  changes_requested: 'orange',
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
            <Badge color={statusBadgeColors[review.status]} variant="soft" radius="full" size="1">
              {statusLabels[review.status]}
            </Badge>
            {review.decision && (
              <Badge color={decisionBadgeColors[review.decision]} variant="soft" radius="full" size="1">
                {decisionLabels[review.decision]}
              </Badge>
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
