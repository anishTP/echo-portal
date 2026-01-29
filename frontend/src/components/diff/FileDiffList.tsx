import { useState, memo } from 'react';
import { Button, Badge, Spinner } from '@radix-ui/themes';
import { DiffViewer, type FileDiff } from './DiffViewer';

export interface BranchDiff {
  branchId: string;
  baseRef: string;
  headRef: string;
  baseCommit: string;
  headCommit: string;
  files: FileDiff[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

interface FileDiffListProps {
  diff: BranchDiff;
  isLoading?: boolean;
}

type FilterType = 'all' | 'added' | 'modified' | 'deleted';

export function FileDiffList({ diff, isLoading }: FileDiffListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandAll, setExpandAll] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="3" />
      </div>
    );
  }

  const filteredFiles =
    filter === 'all'
      ? diff.files
      : diff.files.filter((f) => f.status === filter);

  const addedCount = diff.files.filter((f) => f.status === 'added').length;
  const modifiedCount = diff.files.filter((f) => f.status === 'modified').length;
  const deletedCount = diff.files.filter((f) => f.status === 'deleted').length;

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="font-medium text-gray-900">
              {diff.stats.filesChanged}
            </span>{' '}
            <span className="text-gray-500">
              file{diff.stats.filesChanged !== 1 ? 's' : ''} changed
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-600">
              +{diff.stats.additions} additions
            </span>
            <span className="text-red-600">
              -{diff.stats.deletions} deletions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="1" onClick={() => setExpandAll(!expandAll)}>
            {expandAll ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter:</span>
        <Button
          variant={filter === 'all' ? 'solid' : 'soft'}
          size="1"
          color="gray"
          onClick={() => setFilter('all')}
        >
          All ({diff.files.length})
        </Button>
        {addedCount > 0 && (
          <Button
            variant={filter === 'added' ? 'solid' : 'soft'}
            size="1"
            color="green"
            onClick={() => setFilter('added')}
          >
            Added ({addedCount})
          </Button>
        )}
        {modifiedCount > 0 && (
          <Button
            variant={filter === 'modified' ? 'solid' : 'soft'}
            size="1"
            color="yellow"
            onClick={() => setFilter('modified')}
          >
            Modified ({modifiedCount})
          </Button>
        )}
        {deletedCount > 0 && (
          <Button
            variant={filter === 'deleted' ? 'solid' : 'soft'}
            size="1"
            color="red"
            onClick={() => setFilter('deleted')}
          >
            Deleted ({deletedCount})
          </Button>
        )}
      </div>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No files to display</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFiles.map((file) => (
            <DiffViewer
              key={file.path}
              file={file}
              defaultExpanded={expandAll}
            />
          ))}
        </div>
      )}

      {/* Commit Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">Base:</span>{' '}
            <span className="font-mono text-gray-900">
              {diff.baseRef} ({diff.baseCommit.slice(0, 8)})
            </span>
          </div>
          <div>
            <span className="text-gray-500">Head:</span>{' '}
            <span className="font-mono text-gray-900">
              {diff.headRef} ({diff.headCommit.slice(0, 8)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FileDiffSummary = memo(function FileDiffSummary({
  summary,
  isLoading,
}: {
  summary: {
    added: string[];
    modified: string[];
    deleted: string[];
    total: number;
  } | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner size="1" />
        Loading changes...
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="text-sm text-gray-500">No changes detected</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700">
        {summary.total} file{summary.total !== 1 ? 's' : ''} changed
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.added.length > 0 && (
          <Badge color="green" variant="soft" size="1">+{summary.added.length} added</Badge>
        )}
        {summary.modified.length > 0 && (
          <Badge color="yellow" variant="soft" size="1">~{summary.modified.length} modified</Badge>
        )}
        {summary.deleted.length > 0 && (
          <Badge color="red" variant="soft" size="1">-{summary.deleted.length} deleted</Badge>
        )}
      </div>
    </div>
  );
});

export default FileDiffList;
