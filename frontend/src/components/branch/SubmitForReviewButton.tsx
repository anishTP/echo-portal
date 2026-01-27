import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { branchService } from '../../services/branchService';
import { api } from '../../services/api';
import type { TeamMember } from './TeamMemberPicker';

interface SubmitForReviewButtonProps {
  branchId: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function SubmitForReviewButton({
  branchId,
  disabled = false,
  onSuccess,
}: SubmitForReviewButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch current reviewers
  const { data: reviewers = [] } = useQuery<TeamMember[]>({
    queryKey: ['branch-reviewers', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/reviewers`),
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      const reviewerIds = reviewers.map((r) => r.id);
      return branchService.submitForReview(branchId, reviewerIds, reason || undefined);
    },
    onSuccess: () => {
      // Invalidate branch queries to refresh state
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setShowModal(false);
      setReason('');
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Failed to submit for review:', error);
      // Error notification would be handled by the mutation hook
    },
  });

  const handleSubmit = useCallback(() => {
    if (reviewers.length === 0) {
      alert('Please assign at least one reviewer before submitting for review.');
      return;
    }
    setShowModal(true);
  }, [reviewers.length]);

  const handleConfirmSubmit = useCallback(() => {
    submitMutation.mutate();
  }, [submitMutation]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setReason('');
  }, []);

  const hasReviewers = reviewers.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !hasReviewers}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          !hasReviewers
            ? 'Please assign at least one reviewer before submitting'
            : 'Submit this branch for review'
        }
      >
        Submit for Review
        {hasReviewers && (
          <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs">
            {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Submit for Review</h2>
            <p className="mt-2 text-sm text-gray-600">
              This branch will be submitted for review to{' '}
              {reviewers.length === 1 ? (
                <strong>{reviewers[0].displayName}</strong>
              ) : (
                <strong>
                  {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
                </strong>
              )}
              .
            </p>

            {/* Reviewers List */}
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700">Assigned Reviewers:</p>
              <ul className="mt-2 space-y-1">
                {reviewers.map((reviewer) => (
                  <li key={reviewer.id} className="flex items-center gap-2 text-sm text-gray-900">
                    {reviewer.avatarUrl ? (
                      <img
                        src={reviewer.avatarUrl}
                        alt={reviewer.displayName}
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-xs font-medium text-gray-600">
                        {reviewer.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{reviewer.displayName}</span>
                    <span className="text-xs text-gray-500">({reviewer.email})</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Optional Reason */}
            <div className="mt-4">
              <label htmlFor="submit-reason" className="block text-sm font-medium text-gray-700">
                Message (optional)
              </label>
              <textarea
                id="submit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add a message for the reviewers..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitMutation.isPending}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitMutation.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>

            {/* Error Display */}
            {submitMutation.isError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-800">
                  {(submitMutation.error as any)?.message || 'Failed to submit for review'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default SubmitForReviewButton;
