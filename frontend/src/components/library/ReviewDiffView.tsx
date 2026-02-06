import { useState } from 'react';
import type { FileDiff } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import type { TextSelection } from '../../hooks/useTextSelection';
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
  /** Called when user submits a comment on selected text */
  onSubmitComment?: (content: string, selection: TextSelection, filePath: string) => Promise<void>;
  /** Current user ID for permission checks */
  currentUserId?: string;
  /** Branch author ID for permission checks */
  branchAuthorId?: string;
  /** Callback when resolving a comment */
  onResolve?: (commentId: string) => Promise<unknown>;
  /** Callback when unresolving a comment */
  onUnresolve?: (commentId: string) => Promise<unknown>;
}


/**
 * Main content component showing the diff for a single selected content item.
 * Reuses DiffFileHeader and DiffHunk from the review components.
 *
 * Commenting is selection-based: select any text to add a comment.
 */
export function ReviewDiffView({
  file,
  displayMode,
  isLoading,
  comments,
  onSubmitComment,
  currentUserId,
  branchAuthorId,
  onResolve,
  onUnresolve,
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
    // Filter comments for this specific file
    const fileComments = comments?.filter((c) => c.path === file.path);

    return (
      <div className={displayMode === 'unified' ? styles.containerUnified : styles.container}>
        <FullArticleDiffView
          file={file}
          displayMode={displayMode}
          comments={fileComments}
          onSubmitComment={
            onSubmitComment
              ? (content, selection) => onSubmitComment(content, selection, file.path)
              : undefined
          }
          currentUserId={currentUserId}
          branchAuthorId={branchAuthorId}
          onResolve={onResolve}
          onUnresolve={onUnresolve}
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
