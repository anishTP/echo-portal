/**
 * CommentViewPopover - Displays an existing comment when clicking its indicator.
 *
 * Shows the comment content, author info, and timestamp in a floating popover.
 * Includes reply input and resolve functionality.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReviewComment } from '../../services/reviewService';
import styles from './CommentViewPopover.module.css';

interface CommentViewPopoverProps {
  comment: ReviewComment;
  /** Replies to this comment (threaded comments) */
  replies?: ReviewComment[];
  position: { top: number; left: number };
  onClose: () => void;
  /** Current user ID for permission checks */
  currentUserId?: string;
  /** Branch author ID for permission checks */
  branchAuthorId?: string;
  /** Callback when resolving a comment */
  onResolve?: (commentId: string) => Promise<unknown>;
  /** Callback when unresolving a comment */
  onUnresolve?: (commentId: string) => Promise<unknown>;
  /** Callback when replying to a comment */
  onReply?: (commentId: string, content: string) => Promise<unknown>;
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
  replies = [],
  position,
  onClose,
  currentUserId,
  branchAuthorId,
  onResolve,
  onUnresolve,
  onReply,
}: CommentViewPopoverProps) {
  console.log('[CommentViewPopover] Rendering with:', { comment, replies, repliesLength: replies.length });
  const popoverRef = useRef<HTMLDivElement>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [justResolved, setJustResolved] = useState(false);

  const isResolved = !!comment.resolvedAt || justResolved;

  // Can resolve if: not a reply AND (branch author OR comment author)
  const canResolve = !comment.parentId && currentUserId && (
    currentUserId === branchAuthorId || currentUserId === comment.authorId
  ) && (onResolve || onUnresolve);

  // Can reply if: not already a reply (max 2 levels) AND user is logged in AND has callback
  const canReply = !comment.parentId && currentUserId && onReply;

  const handleResolve = async () => {
    if (onResolve && !isResolving && !isResolved) {
      setIsResolving(true);
      try {
        await onResolve(comment.id);
        setJustResolved(true);
        setReplyContent(''); // Clear reply input
      } catch (error) {
        console.error('Failed to resolve comment:', error);
      } finally {
        setIsResolving(false);
      }
    }
  };

  const handleUnresolve = async () => {
    if (onUnresolve && !isResolving && isResolved) {
      setIsResolving(true);
      try {
        await onUnresolve(comment.id);
        setJustResolved(false);
      } catch (error) {
        console.error('Failed to unresolve comment:', error);
      } finally {
        setIsResolving(false);
      }
    }
  };

  const handleSubmitReply = async () => {
    if (onReply && replyContent.trim() && !isSubmittingReply) {
      setIsSubmittingReply(true);
      try {
        await onReply(comment.id, replyContent.trim());
        setReplyContent('');
      } catch (error) {
        console.error('Failed to submit reply:', error);
      } finally {
        setIsSubmittingReply(false);
      }
    }
  };

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
  }, [position, isResolved]);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      data-comment-popover
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

      {/* Timestamp */}
      <div className={styles.timestamp}>{formatRelativeTime(comment.createdAt)}</div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className={styles.replies}>
          {replies.map((reply) => (
            <div key={reply.id} className={styles.reply}>
              <div className={styles.replyContent}>{reply.content}</div>
              <div className={styles.replyTimestamp}>{formatRelativeTime(reply.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved state - shows when resolved, hides reply input */}
      {isResolved ? (
        <div className={styles.resolvedState}>
          <div className={styles.resolvedMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Comment resolved
          </div>
          {canResolve && onUnresolve && (
            <button
              type="button"
              className={styles.unresolveLink}
              onClick={handleUnresolve}
              disabled={isResolving}
            >
              {isResolving ? 'Unresolving...' : 'Undo'}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Reply input - always visible when not resolved */}
          {canReply && (
            <div className={styles.replySection}>
              <input
                type="text"
                className={styles.replyInput}
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                disabled={isSubmittingReply}
              />
              <div className={styles.actionButtons}>
                <button
                  type="button"
                  className={styles.replyButton}
                  onClick={handleSubmitReply}
                  disabled={isSubmittingReply || !replyContent.trim()}
                >
                  {isSubmittingReply ? 'Sending...' : 'Reply'}
                </button>
                {canResolve && onResolve && (
                  <button
                    type="button"
                    className={styles.resolveButton}
                    onClick={handleResolve}
                    disabled={isResolving}
                  >
                    {isResolving ? 'Resolving...' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Show resolve button even if can't reply */}
          {!canReply && canResolve && onResolve && (
            <div className={styles.actionButtons}>
              <button
                type="button"
                className={styles.resolveButton}
                onClick={handleResolve}
                disabled={isResolving}
              >
                {isResolving ? 'Resolving...' : 'Resolve'}
              </button>
            </div>
          )}
        </>
      )}

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
