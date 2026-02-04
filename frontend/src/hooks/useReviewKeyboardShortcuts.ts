import { useEffect, useCallback } from 'react';

interface ReviewKeyboardShortcutsOptions {
  /** Toggle comments sidebar */
  onToggleComments?: () => void;
  /** Toggle between unified/split display mode */
  onToggleDisplayMode?: () => void;
  /** Navigate to next file */
  onNextFile?: () => void;
  /** Navigate to previous file */
  onPrevFile?: () => void;
  /** Navigate to next comment */
  onNextComment?: () => void;
  /** Navigate to previous comment */
  onPrevComment?: () => void;
  /** Close review overlay */
  onClose?: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

/**
 * Hook for review mode keyboard shortcuts
 *
 * Shortcuts:
 * - Escape: Close review overlay
 * - c: Toggle comments sidebar
 * - d: Toggle unified/split display mode
 * - j / ]: Next file
 * - k / [: Previous file
 * - n: Next comment
 * - p: Previous comment
 */
export function useReviewKeyboardShortcuts({
  onToggleComments,
  onToggleDisplayMode,
  onNextFile,
  onPrevFile,
  onNextComment,
  onPrevComment,
  onClose,
  enabled = true,
}: ReviewKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't handle shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') return;
      }

      // Don't handle when modifier keys are pressed (except for Escape)
      if (event.key !== 'Escape' && (event.metaKey || event.ctrlKey || event.altKey)) {
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose?.();
          break;
        case 'c':
          event.preventDefault();
          onToggleComments?.();
          break;
        case 'd':
          event.preventDefault();
          onToggleDisplayMode?.();
          break;
        case 'j':
        case ']':
          event.preventDefault();
          onNextFile?.();
          break;
        case 'k':
        case '[':
          event.preventDefault();
          onPrevFile?.();
          break;
        case 'n':
          event.preventDefault();
          onNextComment?.();
          break;
        case 'p':
          event.preventDefault();
          onPrevComment?.();
          break;
      }
    },
    [
      enabled,
      onToggleComments,
      onToggleDisplayMode,
      onNextFile,
      onPrevFile,
      onNextComment,
      onPrevComment,
      onClose,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
