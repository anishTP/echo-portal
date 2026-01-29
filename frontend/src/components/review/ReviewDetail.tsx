import { Badge } from '@radix-ui/themes';
import { useBranchReviewStats } from '../../hooks/useReview';
import type { ReviewResponse } from '../../services/reviewService';

interface ReviewDetailProps {
  review: ReviewResponse;
  requiredApprovals?: number;
}

interface ApprovalStatusProps {
  approvedCount: number;
  requiredApprovals: number;
  totalReviewers: number;
}

function ApprovalStatus({
  approvedCount,
  requiredApprovals,
  totalReviewers,
}: ApprovalStatusProps) {
  const progress = (approvedCount / requiredApprovals) * 100;
  const isApproved = approvedCount >= requiredApprovals;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Approval Status</h3>
        <Badge color={isApproved ? 'green' : 'orange'} variant="soft" radius="full" size="1">
          {isApproved ? 'Approved' : 'Pending'}
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>
              {approvedCount} of {requiredApprovals} required approval{requiredApprovals !== 1 ? 's' : ''}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isApproved ? 'bg-green-600' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Review Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{totalReviewers} reviewer{totalReviewers !== 1 ? 's' : ''} assigned</span>
          {!isApproved && (
            <span className="text-orange-600 font-medium">
              {requiredApprovals - approvedCount} more needed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReviewDetail({ review, requiredApprovals = 1 }: ReviewDetailProps) {
  const { data: stats } = useBranchReviewStats(review.branchId);

  // Calculate approval counts
  const approvedCount = stats?.approvedCount ?? 0;
  const totalReviewers = stats?.totalReviewers ?? 1;

  // Status badge
  const getStatusBadge = () => {
    const statusConfig: Record<string, { color: 'yellow' | 'blue' | 'green' | 'gray'; label: string }> = {
      pending: { color: 'yellow', label: 'Pending' },
      in_progress: { color: 'blue', label: 'In Progress' },
      completed: { color: 'green', label: 'Completed' },
      cancelled: { color: 'gray', label: 'Cancelled' },
    };
    const config = statusConfig[review.status];
    if (!config) return null;
    return (
      <Badge color={config.color} variant="soft" radius="full" size="1">
        {config.label}
      </Badge>
    );
  };

  // Decision badge
  const getDecisionBadge = () => {
    if (!review.decision) return null;
    const decisionConfig: Record<string, { color: 'green' | 'orange'; label: string }> = {
      approved: { color: 'green', label: '✓ Approved' },
      changes_requested: { color: 'orange', label: '⚠ Changes Requested' },
    };
    const config = decisionConfig[review.decision];
    if (!config) return null;
    return (
      <Badge color={config.color} variant="soft" radius="full" size="1">
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Review Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Review Details</h2>
            <p className="mt-1 text-sm text-gray-500">Review ID: {review.id}</p>
          </div>
          <div className="flex gap-2">
            {getStatusBadge()}
            {getDecisionBadge()}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Reviewer</p>
            <p className="mt-1 text-sm text-gray-900">{review.reviewerId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Requested By</p>
            <p className="mt-1 text-sm text-gray-900">{review.requestedById}</p>
          </div>
        </div>
      </div>

      {/* Approval Status Indicator */}
      {review.status !== 'cancelled' && (
        <ApprovalStatus
          approvedCount={approvedCount}
          requiredApprovals={requiredApprovals}
          totalReviewers={totalReviewers}
        />
      )}

      {/* Additional Info */}
      {review.reason && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            {review.decision === 'approved' ? 'Approval Comment' : 'Reason for Changes'}
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.reason}</p>
        </div>
      )}
    </div>
  );
}

export default ReviewDetail;
