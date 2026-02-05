/**
 * FullArticleDiffView - Displays full article content with diff highlighting.
 *
 * Unified view: Renders as prose with markdown formatting, paragraph-level highlighting.
 * Split view: Side-by-side raw text panels with line numbers and character-level highlights.
 */

import { Link } from 'react-router-dom';
import type { FileDiff, DiffLine } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import { buildLineDiffMap } from '../../utils/diffLineMapping';
import { DiffMarkdownRenderer } from './DiffMarkdownRenderer';
import styles from './FullArticleDiffView.module.css';

interface FullArticleDiffViewProps {
  file: FileDiff;
  displayMode: 'unified' | 'split';
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
}

interface CharSegment {
  text: string;
  highlight: boolean;
}

/**
 * Compute character-level diff between two strings.
 */
function computeCharDiff(
  oldStr: string,
  newStr: string
): { oldSegments: CharSegment[]; newSegments: CharSegment[] } {
  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }

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

  if (oldSegments.length === 0) oldSegments.push({ text: '', highlight: false });
  if (newSegments.length === 0) newSegments.push({ text: '', highlight: false });

  return { oldSegments, newSegments };
}

/**
 * Check if two strings are similar enough for character-level diff.
 */
function areSimilarEnough(oldStr: string, newStr: string): boolean {
  if (!oldStr || !newStr) return false;
  const longer = oldStr.length > newStr.length ? oldStr : newStr;
  const shorter = oldStr.length > newStr.length ? newStr : oldStr;

  if (longer.length === 0) return true;

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

export function FullArticleDiffView({
  file,
  displayMode,
  getComments,
  onLineClick,
}: FullArticleDiffViewProps) {
  const { fullContent, hunks, additions, deletions } = file;

  if (!fullContent) {
    return (
      <div className={styles.error}>
        No full content available. Falling back to hunk view.
      </div>
    );
  }

  const { oldContent, newContent, metadata } = fullContent;

  // Render unified prose view
  if (displayMode === 'unified') {
    return (
      <UnifiedArticleView
        oldContent={oldContent}
        newContent={newContent}
        metadata={metadata}
        hunks={hunks}
      />
    );
  }

  // Render split view
  return (
    <SplitArticleView
      oldContent={oldContent}
      newContent={newContent}
      metadata={metadata}
      hunks={hunks}
      additions={additions}
      deletions={deletions}
      getComments={getComments}
      onLineClick={onLineClick}
      filePath={file.path}
    />
  );
}

/**
 * Unified view - Full rendered article with paragraph-level diff highlighting.
 * Shows the new version with changes highlighted.
 */
function UnifiedArticleView({
  oldContent,
  newContent,
  metadata,
  hunks,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  hunks: FileDiff['hunks'];
}) {
  const currentMeta = metadata.new || metadata.old;
  const body = newContent || oldContent || '';

  // Check if metadata changed
  const metaChanged = metadata.old && metadata.new && (
    metadata.old.title !== metadata.new.title ||
    metadata.old.description !== metadata.new.description ||
    metadata.old.category !== metadata.new.category ||
    JSON.stringify(metadata.old.tags) !== JSON.stringify(metadata.new.tags)
  );

  return (
    <article className={styles.article}>
      {/* Category breadcrumb */}
      {currentMeta?.category && (
        <div className={styles.breadcrumb}>
          <Link to={`/?category=${encodeURIComponent(currentMeta.category)}`}>
            {currentMeta.category}
          </Link>
          {metaChanged && metadata.old?.category !== metadata.new?.category && (
            <span className={styles.metaChangeBadge}>Changed</span>
          )}
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          {currentMeta?.title}
          {metaChanged && metadata.old?.title !== metadata.new?.title && (
            <span className={styles.titleChange}>
              <span className={styles.oldTitle}>{metadata.old?.title}</span>
              <span className={styles.arrow}>&rarr;</span>
            </span>
          )}
        </h1>
        {currentMeta?.description && (
          <p className={styles.description}>
            {currentMeta.description}
            {metaChanged && metadata.old?.description !== metadata.new?.description && (
              <span className={styles.metaChangeBadge}>Updated</span>
            )}
          </p>
        )}
      </header>

      {/* Body with diff highlighting */}
      <div className={styles.body}>
        <DiffMarkdownRenderer
          content={body}
          hunks={hunks}
          side="new"
        />
      </div>

      {/* Show deleted content at the end if applicable */}
      {oldContent && newContent && oldContent !== newContent && (
        <details className={styles.deletedContent}>
          <summary className={styles.deletedSummary}>
            View deleted content
          </summary>
          <div className={styles.deletedBody}>
            <DiffMarkdownRenderer
              content={oldContent}
              hunks={hunks}
              side="old"
            />
          </div>
        </details>
      )}
    </article>
  );
}

/**
 * Split view - Side-by-side raw text with line numbers and char-level diff.
 */
function SplitArticleView({
  oldContent,
  newContent,
  metadata,
  hunks,
  additions,
  deletions,
  getComments,
  onLineClick,
  filePath,
}: {
  oldContent: string | null;
  newContent: string | null;
  metadata: {
    old: { title: string; description: string | null; category: string | null; tags: string[] } | null;
    new: { title: string; description: string | null; category: string | null; tags: string[] } | null;
  };
  hunks: FileDiff['hunks'];
  additions: number;
  deletions: number;
  getComments: (path: string, line: number, side: 'old' | 'new') => ReviewComment[];
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  filePath: string;
}) {
  const oldLines = oldContent?.split('\n') || [];
  const newLines = newContent?.split('\n') || [];

  // Build line pairs from hunks for aligned display
  const pairs = buildAlignedPairsFromContent(oldLines, newLines, hunks);

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
    const meta = isOld ? metadata.old : metadata.new;

    return (
      <div className={`${styles.panel} ${isOld ? styles.panelOld : styles.panelNew}`}>
        {/* Panel header with counts */}
        {count > 0 && (
          <div className={`${styles.panelHeader} ${isOld ? styles.panelHeaderOld : styles.panelHeaderNew}`}>
            <span className={styles.panelHeaderIcon}>
              {isOld ? '\u2296' : '\u2295'}
            </span>
            <span className={styles.panelHeaderCount}>
              {count} {label}
            </span>
          </div>
        )}

        {/* Metadata header if available */}
        {meta && (
          <div className={styles.panelMeta}>
            {meta.category && (
              <span className={styles.panelMetaCategory}>{meta.category}</span>
            )}
            <span className={styles.panelMetaTitle}>{meta.title}</span>
            {meta.description && (
              <span className={styles.panelMetaDesc}>{meta.description}</span>
            )}
          </div>
        )}

        {/* Content table */}
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
                  key={`${side}-${index}`}
                  className={`${styles.splitRow} ${onLineClick && line ? styles.splitRowClickable : ''}`}
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
}

/**
 * Build aligned line pairs for split view from full content.
 * Uses hunk information to identify changes.
 */
function buildAlignedPairsFromContent(
  oldLines: string[],
  newLines: string[],
  hunks: FileDiff['hunks']
): Array<{ old: DiffLine | null; new: DiffLine | null }> {
  const pairs: Array<{ old: DiffLine | null; new: DiffLine | null }> = [];

  // Build maps from hunks to know which lines are changes
  const diffMaps = buildLineDiffMap(hunks);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLineNum = oldIdx + 1;
    const newLineNum = newIdx + 1;

    const oldInfo = diffMaps.oldMap.get(oldLineNum);
    const newInfo = diffMaps.newMap.get(newLineNum);

    // Deletion without matching addition
    if (oldInfo?.type === 'deletion' && newInfo?.type !== 'addition') {
      pairs.push({
        old: {
          type: 'deletion',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: null,
      });
      oldIdx++;
      continue;
    }

    // Addition without matching deletion
    if (newInfo?.type === 'addition' && oldInfo?.type !== 'deletion') {
      pairs.push({
        old: null,
        new: {
          type: 'addition',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      newIdx++;
      continue;
    }

    // Paired deletion and addition
    if (oldInfo?.type === 'deletion' && newInfo?.type === 'addition') {
      pairs.push({
        old: {
          type: 'deletion',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: {
          type: 'addition',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      oldIdx++;
      newIdx++;
      continue;
    }

    // Both are context or unchanged - pair them
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      pairs.push({
        old: {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        },
        new: {
          type: 'context',
          content: newLines[newIdx],
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        },
      });
      oldIdx++;
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      pairs.push({
        old: {
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum,
        },
        new: null,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      pairs.push({
        old: null,
        new: {
          type: 'context',
          content: newLines[newIdx],
          newLineNumber: newLineNum,
        },
      });
      newIdx++;
    }
  }

  return pairs;
}

export default FullArticleDiffView;
