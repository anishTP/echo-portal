import { useMemo, memo } from 'react';

export interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
  actor?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

interface AuditTrailProps {
  entries: AuditEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
  showResourceInfo?: boolean;
}

const actionLabels: Record<string, string> = {
  branch_created: 'Created branch',
  branch_updated: 'Updated branch',
  branch_deleted: 'Deleted branch',
  branch_state_transitioned: 'Changed state',
  branch_visibility_changed: 'Changed visibility',
  review_requested: 'Requested review',
  review_completed: 'Completed review',
  review_comment_added: 'Added comment',
  convergence_initiated: 'Started convergence',
  convergence_succeeded: 'Published successfully',
  convergence_failed: 'Convergence failed',
  convergence_rolled_back: 'Rolled back convergence',
  user_created: 'User created',
  user_updated: 'User updated',
  user_role_changed: 'Role changed',
  user_deactivated: 'User deactivated',
};

const actionIcons: Record<string, React.ReactNode> = {
  branch_created: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  branch_updated: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  branch_state_transitioned: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  ),
  review_completed: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  convergence_succeeded: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  convergence_failed: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const actionColors: Record<string, string> = {
  branch_created: 'bg-green-100 text-green-600',
  branch_updated: 'bg-blue-100 text-blue-600',
  branch_deleted: 'bg-red-100 text-red-600',
  branch_state_transitioned: 'bg-purple-100 text-purple-600',
  branch_visibility_changed: 'bg-yellow-100 text-yellow-600',
  review_requested: 'bg-orange-100 text-orange-600',
  review_completed: 'bg-green-100 text-green-600',
  convergence_succeeded: 'bg-green-100 text-green-600',
  convergence_failed: 'bg-red-100 text-red-600',
  convergence_rolled_back: 'bg-orange-100 text-orange-600',
};

export const AuditTrail = memo(function AuditTrail({
  entries,
  isLoading = false,
  emptyMessage = 'No activity recorded yet.',
  showResourceInfo = false,
}: AuditTrailProps) {
  const groupedByDate = useMemo(() => {
    const groups: Map<string, AuditEntry[]> = new Map();

    for (const entry of entries) {
      const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(entry);
    }

    return groups;
  }, [entries]);

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getActionLabel = (action: string): string => {
    return actionLabels[action] || action.replace(/_/g, ' ');
  };

  const getActionIcon = (action: string): React.ReactNode => {
    return (
      actionIcons[action] || (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    );
  };

  const getActionColor = (action: string): string => {
    return actionColors[action] || 'bg-gray-100 text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedByDate.entries()).map(([date, dateEntries]) => (
        <div key={date}>
          <h4 className="mb-3 text-sm font-medium text-gray-500">{date}</h4>
          <div className="relative space-y-4 pl-4">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />

            {dateEntries.map((entry) => (
              <div key={entry.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full ${getActionColor(entry.action)}`}
                >
                  {getActionIcon(entry.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Actor */}
                    {entry.actor ? (
                      <div className="flex items-center gap-2">
                        {entry.actor.avatarUrl ? (
                          <img
                            src={entry.actor.avatarUrl}
                            alt={entry.actor.displayName}
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                            {getInitials(entry.actor.displayName)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {entry.actor.displayName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">System</span>
                    )}
                    <span className="text-sm text-gray-500">
                      {getActionLabel(entry.action)}
                    </span>
                  </div>

                  {/* Metadata */}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {entry.metadata.fromState && entry.metadata.toState && (
                        <span>
                          {String(entry.metadata.fromState)} → {String(entry.metadata.toState)}
                        </span>
                      )}
                      {entry.metadata.reason && (
                        <span className="ml-2 italic">
                          "{String(entry.metadata.reason)}"
                        </span>
                      )}
                    </div>
                  )}

                  {/* Resource info */}
                  {showResourceInfo && (
                    <div className="mt-1 text-xs text-gray-400">
                      {entry.resourceType}: {entry.resourceId.slice(0, 8)}...
                    </div>
                  )}

                  {/* Time */}
                  <div className="mt-1 text-xs text-gray-400">
                    {formatTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

export default AuditTrail;
