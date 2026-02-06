import type { DiffHunk as DiffHunkType, DiffLine } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import styles from './DiffHunk.module.css';

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath: string;
  displayMode: 'unified' | 'split';
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  commentingAt?: { line: number; side: 'old' | 'new' } | null;
  additions?: number;
  deletions?: number;
}

interface CharSegment {
  text: string;
  highlight: boolean;
}

/**
 * Compute character-level diff between two strings.
 * Returns segments with highlight flags for the differing portions.
 */
function computeCharDiff(
  oldStr: string,
  newStr: string
): { oldSegments: CharSegment[]; newSegments: CharSegment[] } {
  // Find common prefix
  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix (but don't overlap with prefix)
  let suffixLen = 0;
  while (
    suffixLen < oldStr.length - prefixLen &&
    suffixLen < newStr.length - prefixLen &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldPrefix = oldStr.slice(0, prefixLen);
  const oldMiddle = oldStr.slice(prefixLen, oldStr.length - suffixLen);
  const oldSuffix = oldStr.slice(oldStr.length - suffixLen);

  const newPrefix = newStr.slice(0, prefixLen);
  const newMiddle = newStr.slice(prefixLen, newStr.length - suffixLen);
  const newSuffix = newStr.slice(newStr.length - suffixLen);

  const oldSegments: CharSegment[] = [];
  const newSegments: CharSegment[] = [];

  if (oldPrefix) oldSegments.push({ text: oldPrefix, highlight: false });
  if (oldMiddle) oldSegments.push({ text: oldMiddle, highlight: true });
  if (oldSuffix) oldSegments.push({ text: oldSuffix, highlight: false });

  if (newPrefix) newSegments.push({ text: newPrefix, highlight: false });
  if (newMiddle) newSegments.push({ text: newMiddle, highlight: true });
  if (newSuffix) newSegments.push({ text: newSuffix, highlight: false });

  // If no segments (empty strings), return at least one empty segment
  if (oldSegments.length === 0) oldSegments.push({ text: '', highlight: false });
  if (newSegments.length === 0) newSegments.push({ text: '', highlight: false });

  return { oldSegments, newSegments };
}

/**
 * Check if two strings are similar enough to warrant character-level diff.
 * Uses a simple heuristic: strings share >40% of their characters.
 */
function areSimilarEnough(oldStr: string, newStr: string): boolean {
  if (!oldStr || !newStr) return false;
  const longer = oldStr.length > newStr.length ? oldStr : newStr;
  const shorter = oldStr.length > newStr.length ? newStr : oldStr;

  if (longer.length === 0) return true;

  // Count matching characters (simple approach)
  let matches = 0;
  const shorterChars = new Map<string, number>();
  for (const char of shorter) {
    shorterChars.set(char, (shorterChars.get(char) || 0) + 1);
  }
  for (const char of longer) {
    const count = shorterChars.get(char) || 0;
    if (count > 0) {
      matches++;
      shorterChars.set(char, count - 1);
    }
  }

  return matches / longer.length > 0.4;
}

/**
 * Renders a diff hunk with line-level highlighting
 * Supports both unified and split view modes
 */
export function DiffHunk({
  hunk,
  filePath,
  displayMode,
  getComments,
  onLineClick,
  commentingAt,
  additions = 0,
  deletions = 0,
}: DiffHunkProps) {
  const renderUnifiedView = () => {
    return (
      <div className={styles.unifiedContainer}>
        {/* Subtle separator instead of @@ header */}
        <div className={styles.hunkSeparator}>
          <span>Lines {hunk.oldStart}–{hunk.oldStart + hunk.oldLines - 1}</span>
        </div>

        {hunk.lines.map((line, index) => {
          const lineNum = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
          const side = line.type === 'deletion' ? 'old' : 'new';
          const comments = lineNum ? getComments(filePath, lineNum, side) : [];
          const isCommenting =
            commentingAt?.line === lineNum && commentingAt?.side === side;

          const lineClasses = [
            styles.unifiedLine,
            line.type === 'addition' && styles.unifiedLineAddition,
            line.type === 'deletion' && styles.unifiedLineDeletion,
            line.type === 'context' && styles.unifiedLineContext,
            onLineClick && styles.unifiedLineClickable,
            isCommenting && styles.unifiedLineCommenting,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={`${hunk.id}-${index}`}
              className={lineClasses}
              onClick={() => lineNum && onLineClick?.(lineNum, side)}
            >
              <span className={styles.unifiedLineNumber}>
                {lineNum || ''}
              </span>
              <span>{line.content}</span>
              {comments.length > 0 && (
                <span className={styles.commentBadge}>{comments.length}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSplitView = () => {
    // Pair up deletions and additions for side-by-side display
    const pairs: { old: DiffLine | null; new: DiffLine | null }[] = [];
    const pendingDeletions: DiffLine[] = [];
    const pendingAdditions: DiffLine[] = [];

    const flushPending = () => {
      const maxLen = Math.max(pendingDeletions.length, pendingAdditions.length);
      for (let i = 0; i < maxLen; i++) {
        pairs.push({
          old: pendingDeletions[i] || null,
          new: pendingAdditions[i] || null,
        });
      }
      pendingDeletions.length = 0;
      pendingAdditions.length = 0;
    };

    for (const line of hunk.lines) {
      if (line.type === 'context') {
        flushPending();
        pairs.push({ old: line, new: line });
      } else if (line.type === 'deletion') {
        pendingDeletions.push(line);
      } else if (line.type === 'addition') {
        pendingAdditions.push(line);
      }
    }
    flushPending();

    const renderLineContent = (
      line: DiffLine | null,
      pairedLine: DiffLine | null,
      side: 'old' | 'new'
    ) => {
      if (!line) {
        return <span>&nbsp;</span>;
      }

      // For paired deletion/addition lines, compute character-level diff
      if (
        pairedLine &&
        line.type !== 'context' &&
        pairedLine.type !== 'context' &&
        areSimilarEnough(line.content, pairedLine.content)
      ) {
        const { oldSegments, newSegments } = computeCharDiff(
          side === 'old' ? line.content : pairedLine.content,
          side === 'old' ? pairedLine.content : line.content
        );
        const segments = side === 'old' ? oldSegments : newSegments;

        return (
          <>
            {segments.map((seg, i) => (
              <span
                key={i}
                className={
                  seg.highlight
                    ? side === 'old'
                      ? styles.charHighlightDel
                      : styles.charHighlightAdd
                    : undefined
                }
              >
                {seg.text}
              </span>
            ))}
          </>
        );
      }

      return <span>{line.content}</span>;
    };

    const renderPanel = (side: 'old' | 'new') => {
      const isOld = side === 'old';
      const count = isOld ? deletions : additions;
      const label = isOld ? 'removals' : 'additions';

      return (
        <div className={`${styles.panel} ${isOld ? styles.panelOld : styles.panelNew}`}>
          {count > 0 && (
            <div className={`${styles.panelHeader} ${isOld ? styles.panelHeaderOld : styles.panelHeaderNew}`}>
              <span className={styles.panelHeaderCount}>
                {count} {label}
              </span>
            </div>
          )}
          <table className={styles.panelTable}>
            <tbody>
              {pairs.map((pair, index) => {
                const line = isOld ? pair.old : pair.new;
                const pairedLine = isOld ? pair.new : pair.old;
                const lineNum = line
                  ? isOld
                    ? line.oldLineNumber
                    : line.newLineNumber
                  : null;
                const comments = lineNum ? getComments(filePath, lineNum, side) : [];
                const isCommenting =
                  commentingAt?.line === lineNum && commentingAt?.side === side;

                const rowClasses = [
                  styles.splitRow,
                  onLineClick && line && styles.splitRowClickable,
                  isCommenting && styles.splitRowCommenting,
                ]
                  .filter(Boolean)
                  .join(' ');

                const lineNumberClasses = [
                  styles.lineNumber,
                  line?.type === 'addition' && styles.lineNumberAddition,
                  line?.type === 'deletion' && styles.lineNumberDeletion,
                ]
                  .filter(Boolean)
                  .join(' ');

                const contentClasses = [
                  styles.lineContent,
                  line?.type === 'addition' && styles.lineAddition,
                  line?.type === 'deletion' && styles.lineDeletion,
                  line?.type === 'context' && styles.lineContext,
                  !line && styles.lineEmpty,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <tr
                    key={`${hunk.id}-${side}-${index}`}
                    className={rowClasses}
                    onClick={() => line && lineNum && onLineClick?.(lineNum, side)}
                  >
                    <td className={lineNumberClasses}>{lineNum || ''}</td>
                    <td className={contentClasses}>
                      {renderLineContent(line, pairedLine, side)}
                      {comments.length > 0 && (
                        <span className={styles.commentBadge}>{comments.length}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    return (
      <div className={styles.splitContainer}>
        {renderPanel('old')}
        {renderPanel('new')}
      </div>
    );
  };

  return displayMode === 'unified' ? renderUnifiedView() : renderSplitView();
}

export default DiffHunk;
