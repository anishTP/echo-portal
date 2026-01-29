import { useMemo, memo } from 'react';
import { Button, Badge } from '@radix-ui/themes';

export interface LineageEvent {
  id: string;
  action: string;
  fromState?: string;
  toState?: string;
  timestamp: string;
  actor?: {
    id: string;
    displayName: string;
  };
  reason?: string;
}

export interface BranchLineage {
  branch: {
    id: string;
    name: string;
    slug: string;
    state: string;
    visibility: string;
    createdAt: string;
    owner: {
      id: string;
      displayName: string;
    };
  };
  baseRef: string;
  baseCommit: string;
  headCommit: string;
  events: LineageEvent[];
  convergence?: {
    id: string;
    status: string;
    mergedAt?: string;
    targetBranch: string;
    mergeCommit?: string;
  };
  relatedBranches: {
    id: string;
    name: string;
    relationship: 'sibling' | 'child' | 'parent';
  }[];
}

interface LineageViewerProps {
  lineage: BranchLineage | null;
  isLoading?: boolean;
  onBranchClick?: (branchId: string) => void;
}

const stateColors: Record<string, { color: 'gray' | 'yellow' | 'blue' | 'green'; border: string }> = {
  draft: { color: 'gray', border: 'var(--gray-7)' },
  review: { color: 'yellow', border: 'var(--yellow-7)' },
  approved: { color: 'blue', border: 'var(--blue-7)' },
  published: { color: 'green', border: 'var(--green-7)' },
  archived: { color: 'gray', border: 'var(--gray-6)' },
};

const relationshipLabels: Record<string, string> = {
  sibling: 'Same base',
  child: 'Derived from',
  parent: 'Parent of',
};

export const LineageViewer = memo(function LineageViewer({
  lineage,
  isLoading = false,
  onBranchClick,
}: LineageViewerProps) {
  const timelineEvents = useMemo(() => {
    if (!lineage) return [];

    return lineage.events
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [lineage]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStateColor = (state: string): { color: 'gray' | 'yellow' | 'blue' | 'green'; border: string } => {
    return stateColors[state] || stateColors.draft;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-lg bg-gray-200" />
        <div className="h-32 rounded-lg bg-gray-200" />
        <div className="h-20 rounded-lg bg-gray-200" />
      </div>
    );
  }

  if (!lineage) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">No lineage data available.</p>
      </div>
    );
  }

  const currentStateColor = getStateColor(lineage.branch.state);

  return (
    <div className="space-y-6">
      {/* Branch Header */}
      <div className="rounded-lg p-4" style={{ border: `2px solid ${currentStateColor.border}` }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--gray-12)' }}>{lineage.branch.name}</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--gray-11)' }}>/{lineage.branch.slug}</p>
          </div>
          <Badge color={currentStateColor.color} variant="soft" size="2" radius="full">
            {lineage.branch.state}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="font-medium text-gray-900">{lineage.branch.owner.displayName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Visibility</dt>
            <dd className="font-medium text-gray-900 capitalize">{lineage.branch.visibility}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Base Branch</dt>
            <dd className="font-mono text-gray-900">{lineage.baseRef}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatDate(lineage.branch.createdAt)}</dd>
          </div>
        </div>

        {/* Git Info */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Base:</span>{' '}
              <span className="font-mono">{lineage.baseCommit.slice(0, 7)}</span>
            </div>
            <div>
              <span className="font-medium">Head:</span>{' '}
              <span className="font-mono">{lineage.headCommit.slice(0, 7)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* State Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="mb-4 font-medium text-gray-900">State Timeline</h4>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {timelineEvents.map((event, index) => {
              const toStateColor = event.toState ? getStateColor(event.toState) : null;

              return (
                <div key={event.id} className="relative flex items-start gap-4 pl-8">
                  {/* Timeline dot */}
                  <div
                    className="absolute left-0 h-6 w-6 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: toStateColor ? `var(--${toStateColor.color}-3)` : 'var(--color-background)',
                      border: `2px solid ${toStateColor ? toStateColor.border : 'var(--gray-7)'}`,
                    }}
                  >
                    {index === timelineEvents.length - 1 && (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {event.fromState && event.toState ? (
                        <>
                          <Badge color={getStateColor(event.fromState).color} variant="soft" size="1">
                            {event.fromState}
                          </Badge>
                          <svg className="h-4 w-4" style={{ color: 'var(--gray-9)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <Badge color={getStateColor(event.toState).color} variant="soft" size="1">
                            {event.toState}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-sm font-medium" style={{ color: 'var(--gray-12)' }}>
                          {event.action.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    {event.actor && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--gray-11)' }}>
                        by {event.actor.displayName}
                      </p>
                    )}

                    {event.reason && (
                      <p className="mt-1 text-xs italic" style={{ color: 'var(--gray-11)' }}>"{event.reason}"</p>
                    )}

                    <p className="mt-1 text-xs" style={{ color: 'var(--gray-10)' }}>{formatDate(event.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Convergence Info */}
      {lineage.convergence && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h4 className="mb-2 font-medium text-green-900">Publication Info</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-green-700">Status</dt>
              <dd className="font-medium capitalize text-green-900">{lineage.convergence.status}</dd>
            </div>
            <div>
              <dt className="text-green-700">Target</dt>
              <dd className="font-mono text-green-900">{lineage.convergence.targetBranch}</dd>
            </div>
            {lineage.convergence.mergedAt && (
              <div>
                <dt className="text-green-700">Merged At</dt>
                <dd className="text-green-900">{formatDate(lineage.convergence.mergedAt)}</dd>
              </div>
            )}
            {lineage.convergence.mergeCommit && (
              <div>
                <dt className="text-green-700">Merge Commit</dt>
                <dd className="font-mono text-green-900">{lineage.convergence.mergeCommit.slice(0, 7)}</dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related Branches */}
      {lineage.relatedBranches.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 font-medium text-gray-900">Related Branches</h4>
          <div className="space-y-2">
            {lineage.relatedBranches.map((related) => (
              <Button
                key={related.id}
                variant="outline"
                size="2"
                onClick={() => onBranchClick?.(related.id)}
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">{related.name}</p>
                  <p className="text-xs opacity-70">{relationshipLabels[related.relationship]}</p>
                </div>
                <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default LineageViewer;
