import { useState } from 'react';
import { usePublishBranch } from '../../hooks/useBranch';
import { useAuth } from '../../context/AuthContext';
import type { BranchResponse } from '../../services/branchService';

interface PublishButtonProps {
  branch: BranchResponse;
  onPublishSuccess?: () => void;
}

export function PublishButton({ branch, onPublishSuccess }: PublishButtonProps) {
  const { user } = useAuth();
  const publishMutation = usePublishBranch();
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if user has publisher or admin role
  const hasPublishRole = user?.roles?.includes('publisher') || user?.roles?.includes('administrator');

  // Check if branch can be published (must be in approved state)
  const canPublish = branch.state === 'approved' && branch.permissions?.canPublish !== false;

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync(branch.id);
      setShowConfirm(false);
      onPublishSuccess?.();
    } catch (err) {
      // Error is handled by the mutation hook
    }
  };

  // Don't show button if user doesn't have permission
  if (!hasPublishRole) {
    return null;
  }

  // Don't show button if branch is already published
  if (branch.state === 'published') {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Published
      </div>
    );
  }

  // Show confirmation dialog
  if (showConfirm) {
    return (
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Confirm Publish</h3>
          <p className="mt-1 text-sm text-gray-600">
            Publishing this branch will make it immutable. You won't be able to make any further changes.
            Are you sure you want to proceed?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={publishMutation.isPending}
            className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing...' : 'Confirm Publish'}
          </button>
        </div>
      </div>
    );
  }

  // Show publish button or disabled state
  return (
    <div>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canPublish || publishMutation.isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {!canPublish && branch.state !== 'approved' ? (
          'Branch must be approved before publishing'
        ) : (
          'Publish Branch'
        )}
      </button>

      {!canPublish && branch.state === 'approved' && (
        <p className="mt-2 text-xs text-gray-500">
          You don't have permission to publish this branch
        </p>
      )}
    </div>
  );
}

export default PublishButton;
