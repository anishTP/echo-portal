import type { ConvergenceStatusType } from '@echo-portal/shared';

interface ConvergenceStatusProps {
  status: ConvergenceStatusType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  ConvergenceStatusType,
  { color: string; bgColor: string; label: string; icon: string }
> = {
  pending: {
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
    label: 'Pending',
    icon: '○',
  },
  validating: {
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
    label: 'Validating',
    icon: '◐',
  },
  merging: {
    color: 'text-purple-800',
    bgColor: 'bg-purple-100',
    label: 'Merging',
    icon: '◑',
  },
  succeeded: {
    color: 'text-green-800',
    bgColor: 'bg-green-100',
    label: 'Succeeded',
    icon: '✓',
  },
  failed: {
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    label: 'Failed',
    icon: '✗',
  },
  rolled_back: {
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
    label: 'Rolled Back',
    icon: '↩',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function ConvergenceStatus({
  status,
  showLabel = true,
  size = 'md',
}: ConvergenceStatusProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function ConvergenceStatusDetail({
  status,
  startedAt,
  completedAt,
  mergeCommit,
}: {
  status: ConvergenceStatusType;
  startedAt?: string | null;
  completedAt?: string | null;
  mergeCommit?: string | null;
}) {
  const config = statusConfig[status];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor}`}>
      <div className="flex items-center gap-2">
        <ConvergenceStatus status={status} size="lg" />
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {startedAt && (
          <div className="flex justify-between">
            <dt className={config.color}>Started</dt>
            <dd className="font-medium">{formatDate(startedAt)}</dd>
          </div>
        )}
        {completedAt && (
          <div className="flex justify-between">
            <dt className={config.color}>Completed</dt>
            <dd className="font-medium">{formatDate(completedAt)}</dd>
          </div>
        )}
        {mergeCommit && (
          <div className="flex justify-between">
            <dt className={config.color}>Merge Commit</dt>
            <dd className="font-mono font-medium">{mergeCommit.slice(0, 8)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default ConvergenceStatus;
