import { useState, memo, useCallback } from 'react';
import { Button, Badge } from '@radix-ui/themes';
import { useVersionHistory, useRevertContent } from '../../hooks/useVersionHistory';
import { RevertDialog } from './RevertDialog';
import type { ContentVersionSummary } from '@echo-portal/shared';

interface VersionHistoryProps {
  contentId: string;
  onSelectDiff?: (from: string, to: string) => void;
  isReadOnly?: boolean;
}

export function VersionHistory({ contentId, onSelectDiff, isReadOnly }: VersionHistoryProps) {
  const { data, isLoading } = useVersionHistory(contentId);
  const revertMutation = useRevertContent(contentId);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [revertVersion, setRevertVersion] = useState<ContentVersionSummary | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  const handleToggleSelect = useCallback(
    (timestamp: string) => {
      setSelectedVersions((prev) => {
        if (prev.includes(timestamp)) {
          return prev.filter((t) => t !== timestamp);
        }
        if (prev.length >= 2) {
          return [prev[1], timestamp];
        }
        return [...prev, timestamp];
      });
    },
    []
  );

  const handleCompare = useCallback(() => {
    if (selectedVersions.length === 2) {
      const [from, to] = selectedVersions.sort();
      onSelectDiff?.(from, to);
    }
  }, [selectedVersions, onSelectDiff]);

  const handleRevertClick = useCallback((version: ContentVersionSummary) => {
    setRevertError(null);
    setRevertVersion(version);
  }, []);

  const handleRevertConfirm = useCallback(
    async (description: string) => {
      if (!revertVersion) return;
      setRevertError(null);
      try {
        await revertMutation.mutateAsync({
          targetVersionTimestamp: revertVersion.versionTimestamp,
          changeDescription: description,
        });
        setRevertVersion(null);
      } catch (err) {
        setRevertError(err instanceof Error ? err.message : 'Failed to revert');
      }
    },
    [revertMutation, revertVersion]
  );

  const handleRevertClose = useCallback(() => {
    setRevertVersion(null);
    setRevertError(null);
  }, []);

  if (isLoading) {
    return <div className="animate-pulse space-y-3 p-4">Loading version history...</div>;
  }

  const versions = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Version History ({data?.total ?? 0})
        </h3>
        {selectedVersions.length === 2 && (
          <Button size="2" onClick={handleCompare}>
            Compare Selected
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {versions.map((version, idx) => (
          <VersionEntry
            key={version.id}
            version={version}
            isLatest={idx === 0}
            isSelected={selectedVersions.includes(version.versionTimestamp)}
            onToggleSelect={() => handleToggleSelect(version.versionTimestamp)}
            onRevert={!isReadOnly && idx > 0 ? () => handleRevertClick(version) : undefined}
          />
        ))}
      </div>

      <RevertDialog
        isOpen={!!revertVersion}
        version={revertVersion}
        onClose={handleRevertClose}
        onRevert={handleRevertConfirm}
        isReverting={revertMutation.isPending}
        error={revertError}
      />
    </div>
  );
}

interface VersionEntryProps {
  version: ContentVersionSummary;
  isLatest: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRevert?: () => void;
}

const VersionEntry = memo(function VersionEntry({
  version,
  isLatest,
  isSelected,
  onToggleSelect,
  onRevert,
}: VersionEntryProps) {
  const formattedDate = new Date(version.versionTimestamp).toLocaleString();
  const sizeKB = (version.byteSize / 1024).toFixed(1);

  return (
    <div
      className={`rounded-lg border p-3 ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1 rounded border-gray-300 text-blue-600"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--gray-12)' }}>{formattedDate}</span>
              {isLatest && (
                <Badge color="green" variant="soft" size="1" radius="full">
                  Current
                </Badge>
              )}
              {version.isRevert && (
                <Badge color="yellow" variant="soft" size="1" radius="full">
                  Revert
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-600">{version.changeDescription}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span>{version.author.displayName}</span>
              <span>&middot;</span>
              <span>{sizeKB} KB</span>
            </div>
          </div>
        </div>
        {onRevert && (
          <Button variant="ghost" size="2" onClick={onRevert}>
            Revert
          </Button>
        )}
      </div>
    </div>
  );
});

export default VersionHistory;
