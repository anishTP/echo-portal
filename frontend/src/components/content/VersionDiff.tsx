import { memo } from 'react';
import { Button } from '@radix-ui/themes';
import { useVersionDiff } from '../../hooks/useVersionHistory';
import type { DiffChange } from '@echo-portal/shared';

interface VersionDiffProps {
  contentId: string;
  fromTimestamp: string;
  toTimestamp: string;
  onClose?: () => void;
}

export function VersionDiff({ contentId, fromTimestamp, toTimestamp, onClose }: VersionDiffProps) {
  const { data: diff, isLoading, error } = useVersionDiff(contentId, fromTimestamp, toTimestamp);

  if (isLoading) {
    return <div className="animate-pulse p-4">Loading diff...</div>;
  }

  if (error || !diff) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load diff. {(error as Error)?.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Version Comparison</h3>
        {onClose && (
          <Button variant="ghost" size="1" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-md bg-gray-50 p-3">
          <div className="font-medium text-gray-700">From</div>
          <div className="text-xs text-gray-500">
            {new Date(diff.from.versionTimestamp).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">{diff.from.author.displayName}</div>
          <div className="mt-1 text-xs text-gray-600">{diff.from.changeDescription}</div>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <div className="font-medium text-gray-700">To</div>
          <div className="text-xs text-gray-500">
            {new Date(diff.to.versionTimestamp).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">{diff.to.author.displayName}</div>
          <div className="mt-1 text-xs text-gray-600">{diff.to.changeDescription}</div>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-green-700">+{diff.summary.additions} additions</span>
        <span className="text-red-700">-{diff.summary.deletions} deletions</span>
        {diff.summary.modifications > 0 && (
          <span className="text-amber-700">{diff.summary.modifications} metadata changes</span>
        )}
      </div>

      {diff.diff.metadataChanges.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-700">Metadata Changes</div>
          {diff.diff.metadataChanges.map((change, idx) => (
            <div key={idx} className="rounded bg-amber-50 p-2 text-xs">
              <span className="font-medium">{change.field}:</span>{' '}
              <span className="text-red-600">{JSON.stringify(change.oldValue)}</span>
              {' -> '}
              <span className="text-green-600">{JSON.stringify(change.newValue)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <div className="min-w-full font-mono text-xs">
          {diff.diff.bodyChanges.map((change, idx) => (
            <DiffBlock key={idx} change={change} />
          ))}
        </div>
      </div>
    </div>
  );
}

const DiffBlock = memo(function DiffBlock({ change }: { change: DiffChange }) {
  const bgClass =
    change.type === 'add'
      ? 'bg-green-50 text-green-900'
      : change.type === 'remove'
        ? 'bg-red-50 text-red-900'
        : 'bg-white text-gray-700';

  const prefix = change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' ';

  return (
    <div className={`whitespace-pre-wrap px-3 py-0.5 ${bgClass}`}>
      <span className="mr-2 select-none text-gray-400">{change.lineStart}</span>
      {prefix} {change.content}
    </div>
  );
});

export default VersionDiff;
