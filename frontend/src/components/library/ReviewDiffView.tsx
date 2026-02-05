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
}

const noopGetComments = (): ReviewComment[] => [];

/**
 * Main content component showing the diff for a single selected content item.
 * Reuses DiffFileHeader and DiffHunk from the review components.
 */
export function ReviewDiffView({
  file,
  displayMode,
  isLoading,
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

  // Use full article view when fullContent is available
  if (file.fullContent) {
    return (
      <div className={displayMode === 'unified' ? styles.containerUnified : styles.container}>
        <FullArticleDiffView
          file={file}
          displayMode={displayMode}
          getComments={noopGetComments}
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
                getComments={noopGetComments}
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
