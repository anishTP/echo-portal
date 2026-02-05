import { useState } from 'react';
import type { FileDiff } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import { DiffFileHeader } from '../review/DiffFileHeader';
import { DiffHunk } from '../review/DiffHunk';
import { FullArticleDiffView } from '../review/FullArticleDiffView';
import styles from './ReviewDiffView.module.css';

export interface ReviewDiffViewProps {
  file: FileDiff | null;
  displayMode: 'unified' | 'split';
  isLoading: boolean;
  /** Comments for this review */
  comments?: ReviewComment[];
  /** Currently active comment form location */
  commentingAt?: { path: string; line: number; side: 'old' | 'new' } | null;
  /** Called when user clicks on a line to add a comment */
  onLineClick?: (path: string, line: number, side: 'old' | 'new') => void;
  /** Called when user submits a comment */
  onSubmitComment?: (content: string) => Promise<void>;
  /** Called when user cancels the comment form */
  onCancelComment?: () => void;
}


/**
 * Main content component showing the diff for a single selected content item.
 * Reuses DiffFileHeader and DiffHunk from the review components.
 */
export function ReviewDiffView({
  file,
  displayMode,
  isLoading,
  comments,
  commentingAt,
  onLineClick,
  onSubmitComment,
  onCancelComment,
}: ReviewDiffViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Loading diff...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Select a content item to view changes</p>
        </div>
      </div>
    );
  }

  if (file.hunks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No changes in this item</p>
        </div>
      </div>
    );
  }

  // Helper to get comments for a specific line
  const getComments = (path: string, line: number, side: 'old' | 'new') => {
    if (!comments) return [];
    return comments.filter(c => c.path === path && c.line === line && c.side === side);
  };

  // Use full article view when fullContent is available
  if (file.fullContent) {
    return (
      <div className={displayMode === 'unified' ? styles.containerUnified : styles.container}>
        <FullArticleDiffView
          file={file}
          displayMode={displayMode}
          getComments={getComments}
          onLineClick={onLineClick ? (line, side) => onLineClick(file.path, line, side) : undefined}
          commentingAt={commentingAt?.path === file.path ? { line: commentingAt.line, side: commentingAt.side } : null}
          onSubmitComment={onSubmitComment}
          onCancelComment={onCancelComment}
        />
      </div>
    );
  }

  // Fallback to hunk-based rendering
  const containerClasses = [
    styles.container,
    displayMode === 'unified' && styles.containerUnified,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClasses = [
    styles.diffWrapper,
    displayMode === 'unified' && styles.diffWrapperUnified,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      <div className={wrapperClasses}>
        <DiffFileHeader
          file={file}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />

        {isExpanded && (
          <div className={styles.hunks}>
            {file.hunks.map((hunk) => (
              <DiffHunk
                key={hunk.id}
                hunk={hunk}
                filePath={file.path}
                displayMode={displayMode}
                getComments={getComments}
                additions={file.additions}
                deletions={file.deletions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewDiffView;
