import { useState, useCallback, useMemo } from 'react';
import type { BranchComparison, FileDiff } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import { DiffFileHeader } from './DiffFileHeader';
import { DiffHunk } from './DiffHunk';

/** Threshold for lazy-loading large files */
const LARGE_FILE_LINE_THRESHOLD = 500;

/** Count total lines across all hunks in a file */
function countFileLines(file: FileDiff): number {
  return file.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
}

interface DiffViewProps {
  comparison: BranchComparison;
  comments: ReviewComment[];
  onAddComment?: (
    path: string,
    line: number,
    side: 'old' | 'new',
    content: string
  ) => Promise<void>;
  displayMode: 'unified' | 'split';
}

/**
 * Main diff view component for the review interface
 * Shows all changed files with their hunks and supports inline commenting
 */
export function DiffView({
  comparison,
  comments,
  onAddComment,
  displayMode,
}: DiffViewProps) {
  // Track which large files the user has explicitly loaded
  const [loadedLargeFiles, setLoadedLargeFiles] = useState<Set<string>>(new Set());

  // Identify large files
  const largeFiles = useMemo(
    () => new Set(
      comparison.files
        .filter((f) => countFileLines(f) > LARGE_FILE_LINE_THRESHOLD)
        .map((f) => f.path)
    ),
    [comparison.files]
  );

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    // Auto-expand first few files (up to 3), skipping large files
    const initial = new Set<string>();
    let count = 0;
    for (const f of comparison.files) {
      if (count >= 3) break;
      if (countFileLines(f) <= LARGE_FILE_LINE_THRESHOLD) {
        initial.add(f.path);
        count++;
      }
    }
    return initial;
  });

  const [commentingAt, setCommentingAt] = useState<{
    path: string;
    line: number;
    side: 'old' | 'new';
  } | null>(null);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const getCommentsForLine = useCallback(
    (path: string, line: number, side: 'old' | 'new') =>
      comments.filter(
        (c) => c.path === path && c.line === line && c.side === side
      ),
    [comments]
  );

  const getCommentsForFile = useCallback(
    (path: string) => comments.filter((c) => c.path === path),
    [comments]
  );

  const handleLineClick = useCallback(
    (path: string, line: number, side: 'old' | 'new') => {
      if (!onAddComment) return;
      setCommentingAt({ path, line, side });
    },
    [onAddComment]
  );

  return (
    <div className="diff-view" role="region" aria-label="File changes">
      {/* Diff stats */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-green-600 font-medium">
          +{comparison.stats.additions}
        </span>
        <span className="text-red-600 font-medium">
          -{comparison.stats.deletions}
        </span>
        <span className="text-gray-500">
          {comparison.stats.filesChanged} file
          {comparison.stats.filesChanged !== 1 ? 's' : ''} changed
        </span>
      </div>

      {/* Divergence warning */}
      {comparison.baseState === 'diverged' && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Base branch has changed
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                The base branch has been updated since this branch was created.
                The comparison shows changes relative to the original base state.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="border rounded-md overflow-hidden">
        {comparison.files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No changes to display
          </div>
        ) : (
          comparison.files.map((file) => (
            <div key={file.path} className="border-b last:border-b-0">
              <DiffFileHeader
                file={file}
                isExpanded={expandedFiles.has(file.path)}
                onToggle={() => toggleFile(file.path)}
                commentCount={getCommentsForFile(file.path).length}
              />

              {expandedFiles.has(file.path) && (
                largeFiles.has(file.path) && !loadedLargeFiles.has(file.path) ? (
                  <div className="p-4 text-center bg-gray-50 dark:bg-gray-800/50 border-t">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Large file ({countFileLines(file)} lines). Click to load diff.
                    </p>
                    <button
                      onClick={() =>
                        setLoadedLargeFiles((prev) => new Set([...prev, file.path]))
                      }
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Load Diff
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {file.hunks.map((hunk) => (
                      <DiffHunk
                        key={hunk.id || `${file.path}-${hunk.oldStart}-${hunk.newStart}`}
                        hunk={hunk}
                        filePath={file.path}
                        displayMode={displayMode}
                        getComments={getCommentsForLine}
                        onLineClick={
                          onAddComment
                            ? (line, side) => handleLineClick(file.path, line, side)
                            : undefined
                        }
                        commentingAt={
                          commentingAt?.path === file.path ? commentingAt : null
                        }
                        additions={file.additions}
                        deletions={file.deletions}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Inline comment form (placeholder - will be enhanced in Phase 5) */}
      {commentingAt && (
        <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Add comment at {commentingAt.path}:{commentingAt.line}
          </div>
          <textarea
            className="w-full border rounded-md p-2 text-sm resize-none"
            rows={3}
            placeholder="Write a comment..."
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setCommentingAt(null)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                // Will be implemented with InlineCommentForm
                setCommentingAt(null);
              }}
            >
              Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiffView;
