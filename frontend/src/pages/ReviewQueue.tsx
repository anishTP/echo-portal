import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMyReviews } from '../hooks/useReview';
import { ReviewPanel } from '../components/review/ReviewPanel';
import { reviewService } from '../services/reviewService';
import type { ReviewStatusType, ReviewDecisionType } from '@echo-portal/shared';

const statusFilters: { value: ReviewStatusType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const decisionLabels: Record<ReviewDecisionType, string> = {
  approved: 'Approved',
  changes_requested: 'Changes Requested',
};

export default function ReviewQueue() {
  const { user, isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ReviewStatusType | 'all'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: reviews = [], isLoading, refetch } = useMyReviews(statusFilter !== 'all');

  const filteredReviews =
    statusFilter === 'all'
      ? reviews
      : reviews.filter((r) => r.status === statusFilter);

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const inProgressCount = reviews.filter((r) => r.status === 'in_progress').length;
  const completedCount = reviews.filter((r) => r.status === 'completed').length;

  const handleApprove = async (reviewId: string, reason?: string) => {
    setIsSubmitting(true);
    try {
      await reviewService.approve(reviewId, reason);
      refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async (reviewId: string, reason: string) => {
    setIsSubmitting(true);
    try {
      await reviewService.requestChanges(reviewId, reason);
      refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (
    reviewId: string,
    content: string,
    path?: string,
    line?: number
  ) => {
    await reviewService.addComment(reviewId, content, path, line);
    refetch();
  };

  const handleCancel = async (reviewId: string) => {
    await reviewService.cancel(reviewId);
    refetch();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Sign in required</h2>
          <p className="mt-2 text-gray-600">Please sign in to view your review queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-gray-400 hover:text-gray-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Review Queue</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-medium text-gray-900">Pending</h3>
              <p className="mt-2 text-3xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-sm text-gray-500">Awaiting your review</p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-medium text-gray-900">In Progress</h3>
              <p className="mt-2 text-3xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-sm text-gray-500">Currently reviewing</p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-medium text-gray-900">Completed</h3>
              <p className="mt-2 text-3xl font-bold text-green-600">{completedCount}</p>
              <p className="text-sm text-gray-500">Reviews completed</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    statusFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Review List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-lg border-4 border-dashed border-gray-200 p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reviews</h3>
              <p className="mt-1 text-sm text-gray-500">
                {statusFilter === 'all'
                  ? "You don't have any reviews assigned to you."
                  : `No ${statusFilter.replace('_', ' ')} reviews.`}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReviews.map((review) => (
                <div key={review.id}>
                  {/* Branch Link Header */}
                  <div className="mb-2 flex items-center gap-2">
                    <Link
                      to={`/branches/${review.branchId}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      View Branch
                    </Link>
                    {review.decision && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          review.decision === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {decisionLabels[review.decision]}
                      </span>
                    )}
                  </div>

                  <ReviewPanel
                    review={review}
                    currentUserId={user?.id || ''}
                    onApprove={handleApprove}
                    onRequestChanges={handleRequestChanges}
                    onAddComment={handleAddComment}
                    onCancel={handleCancel}
                    isSubmitting={isSubmitting}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
