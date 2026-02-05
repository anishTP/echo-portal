import { useState } from 'react';
import { useRequestReview } from '../../hooks/useReview';

interface SubmitForReviewDialogProps {
  branchId: string;
  branchName: string;
  isOpen: boolean;
  onClose: () => void;
  availableReviewers: Array<{ id: string; displayName: string }>;
}

/**
 * Dialog for submitting a branch for review
 * Allows selecting reviewers and adding an optional description
 */
export function SubmitForReviewDialog({
  branchId,
  branchName,
  isOpen,
  onClose,
  availableReviewers,
}: SubmitForReviewDialogProps) {
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const requestReview = useRequestReview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedReviewers.length === 0) {
      return;
    }

    // Request review from each selected reviewer
    for (const reviewerId of selectedReviewers) {
      await requestReview.mutateAsync({ branchId, reviewerId });
    }

    onClose();
  };

  const toggleReviewer = (reviewerId: string) => {
    setSelectedReviewers((prev) =>
      prev.includes(reviewerId)
        ? prev.filter((id) => id !== reviewerId)
        : [...prev, reviewerId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Submit for Review</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Submit "{branchName}" for review. Select one or more reviewers.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Reviewer Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Select Reviewers *
            </label>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {availableReviewers.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  No reviewers available
                </p>
              ) : (
                availableReviewers.map((reviewer) => (
                  <label
                    key={reviewer.id}
                    className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReviewers.includes(reviewer.id)}
                      onChange={() => toggleReviewer(reviewer.id)}
                      className="mr-3"
                    />
                    <span className="text-sm">{reviewer.displayName}</span>
                  </label>
                ))
              )}
            </div>
            {selectedReviewers.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Please select at least one reviewer
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the changes you'd like reviewed..."
              className="w-full px-3 py-2 border rounded-md text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedReviewers.length === 0 || requestReview.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestReview.isPending ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubmitForReviewDialog;
