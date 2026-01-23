import { useState, memo } from 'react';
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
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
          <button
            onClick={() => setExpandAll(!expandAll)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter:</span>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            filter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({diff.files.length})
        </button>
        {addedCount > 0 && (
          <button
            onClick={() => setFilter('added')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === 'added'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            Added ({addedCount})
          </button>
        )}
        {modifiedCount > 0 && (
          <button
            onClick={() => setFilter('modified')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === 'modified'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            }`}
          >
            Modified ({modifiedCount})
          </button>
        )}
        {deletedCount > 0 && (
          <button
            onClick={() => setFilter('deleted')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === 'deleted'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            Deleted ({deletedCount})
          </button>
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
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
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
          <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
            +{summary.added.length} added
          </span>
        )}
        {summary.modified.length > 0 && (
          <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
            ~{summary.modified.length} modified
          </span>
        )}
        {summary.deleted.length > 0 && (
          <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
            -{summary.deleted.length} deleted
          </span>
        )}
      </div>
    </div>
  );
});

export default FileDiffList;
