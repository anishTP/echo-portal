import { useState } from 'react';
import type { FileDiff } from '@echo-portal/shared';
import type { ReviewComment } from '../../services/reviewService';
import { DiffFileHeader } from '../review/DiffFileHeader';
import { DiffHunk } from '../review/DiffHunk';
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

  return (
    <div className={styles.container}>
      <div className={styles.diffWrapper}>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewDiffView;
