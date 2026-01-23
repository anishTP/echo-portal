import { memo } from 'react';
import { Link } from 'react-router-dom';
import { LifecycleStatus } from './LifecycleStatus';
import type { BranchResponse } from '../../services/branchService';
import type { BranchStateType, VisibilityType } from '@echo-portal/shared';

interface BranchListProps {
  branches: BranchResponse[];
  isLoading?: boolean;
  emptyMessage?: string;
  showOwner?: boolean;
}

const visibilityIcons: Record<VisibilityType, string> = {
  private: '🔒',
  team: '👥',
  public: '🌐',
};

export function BranchList({
  branches,
  isLoading,
  emptyMessage = 'No branches found',
  showOwner = false,
}: BranchListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="h-5 w-1/3 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-2/3 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {branches.map((branch) => (
        <BranchListItem key={branch.id} branch={branch} showOwner={showOwner} />
      ))}
    </div>
  );
}

interface BranchListItemProps {
  branch: BranchResponse;
  showOwner?: boolean;
}

const BranchListItem = memo(function BranchListItem({ branch, showOwner }: BranchListItemProps) {
  const formattedDate = new Date(branch.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      to={`/branches/${branch.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-medium text-gray-900">{branch.name}</h3>
            <span title={branch.visibility}>
              {visibilityIcons[branch.visibility as VisibilityType]}
            </span>
          </div>

          {branch.description && (
            <p className="mt-1 truncate text-sm text-gray-500">{branch.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Based on {branch.baseRef}</span>
            <span>&middot;</span>
            <span>Updated {formattedDate}</span>
            {showOwner && (
              <>
                <span>&middot;</span>
                <span>Owner: {branch.ownerId.slice(0, 8)}...</span>
              </>
            )}
          </div>

          {branch.labels && branch.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {branch.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {label}
                </span>
              ))}
              {branch.labels.length > 3 && (
                <span className="text-xs text-gray-400">+{branch.labels.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        <div className="ml-4 flex-shrink-0">
          <LifecycleStatus state={branch.state as BranchStateType} size="sm" />
        </div>
      </div>
    </Link>
  );
});

export default BranchList;
