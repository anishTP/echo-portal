import type { FileDiff } from '@echo-portal/shared';
import styles from './DiffFileHeader.module.css';

interface DiffFileHeaderProps {
  file: FileDiff;
  isExpanded: boolean;
  onToggle: () => void;
  commentCount?: number;
}

const statusLabels = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

/**
 * Header component for a file in the diff view
 * Shows file status, stats, and expand/collapse toggle
 */
export function DiffFileHeader({
  file,
  isExpanded,
  onToggle,
  commentCount = 0,
}: DiffFileHeaderProps) {
  return (
    <div className={styles.header} onClick={onToggle}>
      <div className={styles.leftSection}>
        {/* Expand/collapse indicator */}
        <svg
          className={styles.expandIcon}
          data-expanded={isExpanded}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>

        {/* File status badge */}
        <span className={styles.statusBadge} data-status={file.status}>
          {statusLabels[file.status]}
        </span>

        {/* File path */}
        <span className={styles.filePath} title={file.path}>
          {file.oldPath && file.status === 'renamed' ? (
            <>
              <span className={styles.oldPath}>{file.oldPath}</span>
              <span className={styles.pathArrow}>→</span>
              <span>{file.path}</span>
            </>
          ) : (
            file.path
          )}
        </span>

        {/* Comment count badge */}
        {commentCount > 0 && (
          <span className={styles.commentBadge}>
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        {file.additions > 0 && (
          <span className={styles.additions}>+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className={styles.deletions}>-{file.deletions}</span>
        )}
      </div>
    </div>
  );
}

export default DiffFileHeader;
