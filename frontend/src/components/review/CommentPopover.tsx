import { useState, useRef, useEffect } from 'react';
import type { TextSelection } from '../../hooks/useTextSelection';
import styles from './CommentPopover.module.css';

interface CommentPopoverProps {
  selection: TextSelection;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Floating comment form that appears near a text selection.
 * Shows a preview of the selected text and a comment textarea.
 */
export function CommentPopover({ selection, onSubmit, onCancel }: CommentPopoverProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-focus the textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay adding listener to avoid immediate closure from the mouseup that triggered selection
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CommentPopover] handleSubmit called', { content: content.trim(), isSubmitting });

    if (!content.trim() || isSubmitting) {
      console.log('[CommentPopover] Early return - empty content or already submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('[CommentPopover] Calling onSubmit...');
      await onSubmit(content.trim());
      console.log('[CommentPopover] onSubmit completed successfully');
      setContent('');
    } catch (error) {
      console.error('[CommentPopover] onSubmit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    // Cancel on Escape
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Position below selection, clamped to viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(selection.rect.bottom + 8, window.innerHeight - 250),
    left: Math.max(16, Math.min(selection.rect.left, window.innerWidth - 416)),
    zIndex: 50,
  };

  // Truncate preview text
  const previewText = selection.text.length > 100
    ? selection.text.slice(0, 100) + '...'
    : selection.text;

  return (
    <div ref={popoverRef} className={styles.popover} style={style} data-comment-popover>
      <form onSubmit={handleSubmit}>
        <div className={styles.selectedTextPreview}>
          "{previewText}"
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={3}
          className={styles.textarea}
          disabled={isSubmitting}
        />

        <div className={styles.footer}>
          <span className={styles.hint}>
            Ctrl+Enter to submit, Esc to cancel
          </span>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={styles.submitButton}
            >
              {isSubmitting ? 'Submitting...' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CommentPopover;
