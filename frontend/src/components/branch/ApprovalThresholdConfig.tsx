import { useState, useEffect } from 'react';
import { branchService } from '../../services/branchService';
import type { BranchResponse } from '../../services/branchService';

interface ApprovalThresholdConfigProps {
  branch: BranchResponse;
  isAdmin: boolean;
  onUpdate?: (branch: BranchResponse) => void;
}

export function ApprovalThresholdConfig({
  branch,
  isAdmin,
  onUpdate,
}: ApprovalThresholdConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [threshold, setThreshold] = useState(branch.requiredApprovals || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update threshold when branch changes
  useEffect(() => {
    setThreshold(branch.requiredApprovals || 1);
  }, [branch.requiredApprovals]);

  const handleSave = async () => {
    if (threshold < 1 || threshold > 10) {
      setError('Approval threshold must be between 1 and 10');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updatedBranch = await branchService.setApprovalThreshold(branch.id, threshold);
      setIsEditing(false);
      onUpdate?.(updatedBranch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval threshold');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setThreshold(branch.requiredApprovals || 1);
    setIsEditing(false);
    setError(null);
  };

  if (!isAdmin) {
    // Non-admin view - just display the current threshold
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Approval Threshold</h3>
            <p className="mt-1 text-sm text-gray-500">
              This branch requires {branch.requiredApprovals || 1} approval
              {(branch.requiredApprovals || 1) !== 1 ? 's' : ''} to proceed
            </p>
          </div>
          <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-3 py-1 text-lg font-semibold text-blue-800">
            {branch.requiredApprovals || 1}
          </span>
        </div>
      </div>
    );
  }

  // Admin view - editable
  if (!isEditing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Approval Threshold</h3>
            <p className="mt-1 text-sm text-gray-500">
              Requires {branch.requiredApprovals || 1} approval
              {(branch.requiredApprovals || 1) !== 1 ? 's' : ''} to approve the branch
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-3 py-1 text-lg font-semibold text-blue-800">
              {branch.requiredApprovals || 1}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Configure
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Editing mode
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Configure Approval Threshold
      </h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
            Required Approvals
          </label>
          <div className="flex items-center gap-4">
            <input
              id="threshold"
              type="number"
              min={1}
              max={10}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              disabled={isSubmitting}
              className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-center text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            />
            <div className="flex-1">
              <input
                type="range"
                min={1}
                max={10}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            The branch will require {threshold} approval{threshold !== 1 ? 's' : ''} from reviewers
            before it can be approved.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalThresholdConfig;
