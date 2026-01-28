import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifecycleStatus } from './LifecycleStatus';
import { VisibilitySelector } from './VisibilitySelector';
import { TeamMemberPicker } from './TeamMemberPicker';
import { CollaboratorPicker } from './CollaboratorPicker';
import { SubmitForReviewButton } from './SubmitForReviewButton';
import { PublishButton } from './PublishButton';
import { EnvironmentIndicator } from '../common/EnvironmentIndicator';
import { PermissionGate } from '../common/PermissionGate';
import { useUpdateBranch, useDeleteBranch } from '../../hooks/useBranch';
import { useAuth } from '../../context/AuthContext';
import type { BranchResponse } from '../../services/branchService';
import type { BranchStateType, VisibilityType } from '@echo-portal/shared';

interface BranchDetailProps {
  branch: BranchResponse;
  onEdit?: () => void;
}

const visibilityLabels: Record<VisibilityType, string> = {
  private: 'Private',
  team: 'Team',
  public: 'Public',
};

export function BranchDetail({ branch, onEdit }: BranchDetailProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false);

  const isOwner = user?.id === branch.ownerId;
  const isDraft = branch.state === 'draft';
  const canChangeVisibility = isOwner && isDraft;
  const { permissions } = branch;

  const handleVisibilityChange = async (newVisibility: VisibilityType) => {
    try {
      await updateBranch.mutateAsync({
        id: branch.id,
        input: { visibility: newVisibility },
      });
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBranch.mutateAsync(branch.id);
      navigate('/dashboard');
    } catch {
      // Error handled by mutation hook
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
            <LifecycleStatus state={branch.state as BranchStateType} />
          </div>
          <div className="mt-2 flex items-center gap-4">
            <EnvironmentIndicator environment="branch" branchName={branch.slug} size="sm" />
            {canChangeVisibility ? (
              <VisibilitySelector
                value={branch.visibility as VisibilityType}
                onChange={handleVisibilityChange}
                disabled={updateBranch.isPending}
                compact
              />
            ) : (
              <span className="text-sm text-gray-500">
                Visibility: {visibilityLabels[branch.visibility as VisibilityType]}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <PermissionGate checkPermission={() => permissions.canEdit}>
            <>
              <button
                onClick={onEdit}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
              >
                Delete
              </button>
            </>
          </PermissionGate>
          <PermissionGate checkPermission={() => permissions.canSubmitForReview && isDraft}>
            <SubmitForReviewButton branchId={branch.id} />
          </PermissionGate>
          <PermissionGate checkPermission={() => permissions.canPublish && branch.state === 'approved'}>
            <PublishButton branch={branch} />
          </PermissionGate>
        </div>
      </div>

      {/* Description */}
      {branch.description && (
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-gray-700">{branch.description}</p>
        </div>
      )}

      {/* Labels */}
      {branch.labels && branch.labels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700">Labels</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {branch.labels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Git Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Git Information</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Base Branch</dt>
            <dd className="mt-1 font-mono text-gray-900">{branch.baseRef}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Git Reference</dt>
            <dd className="mt-1 font-mono text-gray-900">{branch.gitRef}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Base Commit</dt>
            <dd className="mt-1 font-mono text-gray-900">{branch.baseCommit.slice(0, 8)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Head Commit</dt>
            <dd className="mt-1 font-mono text-gray-900">{branch.headCommit.slice(0, 8)}</dd>
          </div>
        </dl>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Timeline</h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatDate(branch.createdAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="text-gray-900">{formatDate(branch.updatedAt)}</dd>
          </div>
          {branch.submittedAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Submitted for Review</dt>
              <dd className="text-gray-900">{formatDate(branch.submittedAt)}</dd>
            </div>
          )}
          {branch.approvedAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Approved</dt>
              <dd className="text-gray-900">{formatDate(branch.approvedAt)}</dd>
            </div>
          )}
          {branch.publishedAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Published</dt>
              <dd className="text-gray-900">{formatDate(branch.publishedAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Permissions */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Available Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.canEdit && (
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
              Can Edit
            </span>
          )}
          {permissions.canSubmitForReview && (
            <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
              Can Submit for Review
            </span>
          )}
          {permissions.canApprove && (
            <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
              Can Approve
            </span>
          )}
          {permissions.canPublish && (
            <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
              Can Publish
            </span>
          )}
          {permissions.canArchive && (
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
              Can Archive
            </span>
          )}
        </div>
      </div>

      {/* Visibility & Reviewers (Owner controls) */}
      {isOwner && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="font-medium text-gray-900">Access Control</h3>
          <div className="mt-4 space-y-6">
            {/* Visibility Settings (expandable for draft branches) */}
            {isDraft && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowVisibilityPanel(!showVisibilityPanel)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-gray-700">Visibility Settings</span>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${showVisibilityPanel ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showVisibilityPanel && (
                  <div className="mt-3">
                    <VisibilitySelector
                      value={branch.visibility as VisibilityType}
                      onChange={handleVisibilityChange}
                      disabled={updateBranch.isPending}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Collaborator Picker */}
            <CollaboratorPicker
              branchId={branch.id}
              disabled={!isDraft}
            />

            {/* Team Member Picker (Reviewers) */}
            <TeamMemberPicker
              branchId={branch.id}
              currentReviewers={branch.reviewers || []}
              disabled={!isDraft}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete Branch</h2>
            <p className="mt-2 text-gray-600">
              Are you sure you want to delete "{branch.name}"? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBranch.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBranch.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchDetail;
