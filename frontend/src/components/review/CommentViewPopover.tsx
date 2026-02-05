/**
 * CommentViewPopover - Displays an existing comment when clicking its indicator.
 *
 * Shows the comment content, author info, and timestamp in a floating popover.
 */

import { useEffect, useRef } from 'react';
import type { ReviewComment } from '../../services/reviewService';
import styles from './CommentViewPopover.module.css';

interface CommentViewPopoverProps {
  comment: ReviewComment;
  position: { top: number; left: number };
  onClose: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function CommentViewPopover({
  comment,
  position,
  onClose,
}: CommentViewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Adjust position if popover would overflow viewport
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const rect = popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if overflowing right
    if (rect.right > viewportWidth - 16) {
      popover.style.left = `${viewportWidth - rect.width - 16}px`;
    }

    // Adjust vertical position if overflowing bottom
    if (rect.bottom > viewportHeight - 16) {
      popover.style.top = `${position.top - rect.height - 16}px`;
    }
  }, [position]);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        top: position.top,
        left: position.left,
      }}
      role="dialog"
      aria-label="Comment"
    >
      {/* Header with quoted text if available */}
      {comment.selectedText && (
        <div className={styles.quotedText}>
          <span className={styles.quoteIcon}>"</span>
          <span className={styles.quoteContent}>
            {comment.selectedText.length > 100
              ? `${comment.selectedText.slice(0, 100)}...`
              : comment.selectedText}
          </span>
        </div>
      )}

      {/* Comment content */}
      <div className={styles.content}>{comment.content}</div>

      {/* Footer with timestamp */}
      <div className={styles.footer}>
        <span className={styles.timestamp}>{formatRelativeTime(comment.createdAt)}</span>
        {comment.isOutdated && (
          <span className={styles.outdatedBadge} title={comment.outdatedReason}>
            Outdated
          </span>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z" />
        </svg>
      </button>
    </div>
  );
}

export default CommentViewPopover;
