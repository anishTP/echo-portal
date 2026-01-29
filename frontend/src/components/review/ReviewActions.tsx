import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { useApproveReview, useRequestChanges } from '../../hooks/useReview';
import type { ReviewResponse } from '../../services/reviewService';

interface ReviewActionsProps {
  review: ReviewResponse;
  onSuccess?: () => void;
}

export function ReviewActions({ review, onSuccess }: ReviewActionsProps) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'changes'>('idle');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const approveMutation = useApproveReview();
  const requestChangesMutation = useRequestChanges();

  const isSubmitting = approveMutation.isPending || requestChangesMutation.isPending;

  // Check if user can perform actions on this review
  const canApprove = review.permissions?.canComplete ?? false;
  const canRequestChanges = review.permissions?.canComplete ?? false;

  const handleApprove = async () => {
    setLocalError(null);
    try {
      await approveMutation.mutateAsync({
        id: review.id,
        reason: reason.trim() || undefined,
      });
      setMode('idle');
      setReason('');
      onSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleRequestChanges = async () => {
    if (!reason.trim()) {
      setLocalError('Please provide a reason for requesting changes');
      return;
    }

    setLocalError(null);
    try {
      await requestChangesMutation.mutateAsync({
        id: review.id,
        reason: reason.trim(),
      });
      setMode('idle');
      setReason('');
      onSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to request changes');
    }
  };

  const handleCancel = () => {
    setMode('idle');
    setReason('');
    setLocalError(null);
  };

  // Don't show actions if user doesn't have permission or review is already completed
  if (!canApprove && !canRequestChanges) {
    return null;
  }

  if (review.status === 'completed' || review.status === 'cancelled') {
    return null;
  }

  if (mode === 'idle') {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Review Actions</h3>
        <div className="flex gap-3">
          <Button
            color="green"
            size="2"
            onClick={() => setMode('approve')}
            disabled={isSubmitting || !canApprove}
            style={{ flex: 1 }}
          >
            Approve
          </Button>
          <Button
            color="orange"
            size="2"
            onClick={() => setMode('changes')}
            disabled={isSubmitting || !canRequestChanges}
            style={{ flex: 1 }}
          >
            Request Changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900">
        {mode === 'approve' ? 'Approve Review' : 'Request Changes'}
      </h3>

      <div className="rounded-lg bg-gray-50 p-4 space-y-4">
        <div>
          <label htmlFor="review-reason" className="block text-sm font-medium text-gray-700">
            {mode === 'approve' ? 'Approval comment (optional)' : 'Reason for requesting changes'}
            {mode === 'changes' && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            id="review-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'approve'
                ? 'Add an optional comment with your approval...'
                : 'Describe what changes are needed...'
            }
            rows={4}
            disabled={isSubmitting}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>

        {localError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {localError}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="2"
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            color={mode === 'approve' ? 'green' : 'orange'}
            size="2"
            onClick={mode === 'approve' ? handleApprove : handleRequestChanges}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          >
            {isSubmitting
              ? 'Submitting...'
              : mode === 'approve'
                ? 'Confirm Approval'
                : 'Submit Changes Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReviewActions;
