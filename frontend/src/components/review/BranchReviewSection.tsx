import { ReviewPanel } from './ReviewPanel';
import type { ReviewResponse } from '../../services/reviewService';
import type { BranchStateType } from '@echo-portal/shared';
import {
  useApproveReview,
  useRequestChanges,
  useCancelReview,
  useAddReviewComment,
} from '../../hooks/useReview';

interface BranchReviewSectionProps {
  reviews: ReviewResponse[];
  currentUserId: string;
  branchState?: BranchStateType;
}

export function BranchReviewSection({ reviews, currentUserId, branchState }: BranchReviewSectionProps) {
  const approveMutation = useApproveReview();
  const requestChangesMutation = useRequestChanges();
  const cancelMutation = useCancelReview();
  const addCommentMutation = useAddReviewComment();

  const isSubmitting =
    approveMutation.isPending || requestChangesMutation.isPending || cancelMutation.isPending;

  const handleApprove = async (reviewId: string, reason?: string) => {
    await approveMutation.mutateAsync({ id: reviewId, reason });
  };

  const handleRequestChanges = async (reviewId: string, reason: string) => {
    await requestChangesMutation.mutateAsync({ id: reviewId, reason });
  };

  const handleAddComment = async (
    reviewId: string,
    content: string,
    path?: string,
    line?: number,
  ) => {
    await addCommentMutation.mutateAsync({ reviewId, content, path, line });
  };

  const handleCancel = async (reviewId: string) => {
    await cancelMutation.mutateAsync({ id: reviewId });
  };

  // Show empty state for reviewers when no reviews exist yet
  if (reviews.length === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900">Reviews</h3>
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-6 text-center">
          {branchState === 'draft' ? (
            <>
              <p className="text-gray-600">This branch hasn't been submitted for review yet.</p>
              <p className="mt-2 text-sm text-gray-500">
                The branch owner needs to submit it before you can start reviewing.
              </p>
            </>
          ) : branchState === 'review' ? (
            <>
              <p className="text-gray-600">No review records found.</p>
              <p className="mt-2 text-sm text-gray-500">
                Review records may not have been created properly. Contact the branch owner.
              </p>
            </>
          ) : (
            <p className="text-gray-600">No reviews available for this branch.</p>
          )}
        </div>
      </div>
    );
  }

  // Derive stats from the reviews array — same data, no separate fetch
  const nonCancelled = reviews.filter((r) => r.status !== 'cancelled');
  const approvedCount = nonCancelled.filter(
    (r) => r.status === 'completed' && r.decision === 'approved',
  ).length;
  const totalCount = nonCancelled.length;
  const progressPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900">Reviews</h3>

      {/* Approval progress */}
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {approvedCount} of {totalCount} approved
          </span>
          <span className="text-gray-500">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Individual reviews */}
      <div className="mt-4 space-y-4">
        {reviews.map((review) => (
          <ReviewPanel
            key={review.id}
            review={review}
            currentUserId={currentUserId}
            onApprove={handleApprove}
            onRequestChanges={handleRequestChanges}
            onAddComment={handleAddComment}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        ))}
      </div>
    </div>
  );
}
