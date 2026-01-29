import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { usePublishBranch } from '../../hooks/useBranch';
import type { BranchResponse } from '../../services/branchService';

interface PublishButtonProps {
  branch: BranchResponse;
  onPublishSuccess?: () => void;
}

export function PublishButton({ branch, onPublishSuccess }: PublishButtonProps) {
  const publishMutation = usePublishBranch();
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if branch can be published (must be in approved state and user has permission)
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
          <Button
            variant="outline"
            size="2"
            style={{ flex: 1 }}
            onClick={() => setShowConfirm(false)}
            disabled={publishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="2"
            style={{ flex: 1 }}
            onClick={handlePublish}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? 'Publishing...' : 'Confirm Publish'}
          </Button>
        </div>
      </div>
    );
  }

  // Show publish button or disabled state
  return (
    <div>
      <Button
        size="2"
        style={{ width: '100%' }}
        onClick={() => setShowConfirm(true)}
        disabled={!canPublish || publishMutation.isPending}
      >
        {!canPublish && branch.state !== 'approved' ? (
          'Branch must be approved before publishing'
        ) : (
          'Publish Branch'
        )}
      </Button>

      {!canPublish && branch.state === 'approved' && (
        <p className="mt-2 text-xs text-gray-500">
          You don't have permission to publish this branch
        </p>
      )}
    </div>
  );
}

export default PublishButton;
