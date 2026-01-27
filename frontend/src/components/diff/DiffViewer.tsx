import { useState, memo } from 'react';

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffViewerProps {
  file: FileDiff;
  defaultExpanded?: boolean;
}

const statusColors: Record<FileDiff['status'], string> = {
  added: 'bg-green-100 text-green-800',
  modified: 'bg-yellow-100 text-yellow-800',
  deleted: 'bg-red-100 text-red-800',
  renamed: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<FileDiff['status'], string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

export const DiffViewer = memo(function DiffViewer({ file, defaultExpanded = true }: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* File Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="text-gray-500">
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[file.status]}`}
          >
            {statusLabels[file.status]}
          </span>
          <span className="font-mono text-sm text-gray-900">{file.path}</span>
          {file.oldPath && file.status === 'renamed' && (
            <span className="text-sm text-gray-500">
              (from {file.oldPath})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">+{file.additions}</span>
          <span className="text-red-600">-{file.deletions}</span>
        </div>
      </div>

      {/* Diff Content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <tbody>
              {file.hunks.map((hunk, hunkIndex) => (
                <HunkView key={hunkIndex} hunk={hunk} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

const HunkView = memo(function HunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      {/* Hunk Header */}
      <tr className="bg-blue-50">
        <td
          colSpan={3}
          className="px-4 py-1 text-xs text-blue-700"
        >
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </td>
      </tr>

      {/* Diff Lines */}
      {hunk.lines.map((line, lineIndex) => (
        <DiffLineView key={lineIndex} line={line} />
      ))}
    </>
  );
});

const DiffLineView = memo(function DiffLineView({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === 'addition'
      ? 'bg-green-50'
      : line.type === 'deletion'
        ? 'bg-red-50'
        : '';

  const textColor =
    line.type === 'addition'
      ? 'text-green-800'
      : line.type === 'deletion'
        ? 'text-red-800'
        : 'text-gray-700';

  const prefix =
    line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';

  return (
    <tr className={bgColor}>
      <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200">
        {line.oldLineNumber || ''}
      </td>
      <td className="w-12 px-2 py-0 text-right text-gray-400 select-none border-r border-gray-200">
        {line.newLineNumber || ''}
      </td>
      <td className={`px-4 py-0 whitespace-pre ${textColor}`}>
        <span className="select-none mr-2">{prefix}</span>
        {line.content}
      </td>
    </tr>
  );
});

export default DiffViewer;
