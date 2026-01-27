import type { BranchResponse } from '../../services/branchService';

interface PublishedBadgeProps {
  branch: BranchResponse;
  showDetails?: boolean;
}

export function PublishedBadge({ branch, showDetails = false }: PublishedBadgeProps) {
  // Only show for published branches
  if (branch.state !== 'published') {
    return null;
  }

  const publishedDate = branch.publishedAt
    ? new Date(branch.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  if (!showDetails) {
    // Compact badge version
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Published (Immutable)
      </span>
    );
  }

  // Detailed card version
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-green-100 p-2">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-medium text-green-900">Published & Immutable</h3>
          <p className="mt-1 text-sm text-green-700">
            This branch was published on {publishedDate} and can no longer be modified.
          </p>

          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2 text-sm text-green-700">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Branch content cannot be changed</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-green-700">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reviewers and collaborators cannot be modified</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-green-700">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Branch settings are locked</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-green-700">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Branch is available for viewing and deployment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublishedBadge;
