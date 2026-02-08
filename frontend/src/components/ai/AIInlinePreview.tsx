import { useEffect, useRef } from 'react';
import { AIStreamDisplay } from './AIStreamDisplay.js';

interface AIInlinePreviewProps {
  /** The AI-generated replacement content */
  content: string;
  /** Whether content is still streaming */
  isStreaming: boolean;
  /** Original text that was selected for transformation */
  originalText: string;
  /** Accept the AI content */
  onAccept: () => void;
  /** Reject and restore original text */
  onReject: () => void;
  /** Cancel in-progress streaming */
  onCancel?: () => void;
  /** Fixed position for the popover (from selection rect) */
  position?: { top: number; left: number } | null;
}

/**
 * AIInlinePreview — floating popover with Accept/Reject toolbar (FR-014)
 *
 * Shows transformed text near the selected text with a visual highlight.
 * Positioned like the review CommentPopover using fixed positioning.
 */
export function AIInlinePreview({
  content,
  isStreaming,
  originalText,
  onAccept,
  onReject,
  onCancel,
  position,
}: AIInlinePreviewProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Adjust position if popover overflows viewport
  useEffect(() => {
    const el = popoverRef.current;
    if (!el || !position) return;

    const rect = el.getBoundingClientRect();
    const padding = 16;

    // Vertical: keep within viewport
    let top = position.top;
    if (top + rect.height > window.innerHeight - padding) {
      top = Math.max(padding, position.top - rect.height - 16);
    }
    el.style.top = `${top}px`;

    // Horizontal: keep within viewport
    let left = position.left;
    if (left + rect.width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    el.style.left = `${left}px`;
  }, [position, content]);

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 50,
        maxWidth: 440,
        minWidth: 300,
      }
    : {};

  return (
    <div
      ref={popoverRef}
      className="ai-inline-preview rounded-lg p-3"
      style={{
        ...style,
        background: 'var(--color-background)',
        border: '1px solid var(--accent-8)',
        boxShadow: 'var(--shadow-4)',
        color: 'var(--gray-12)',
      }}
    >
      {/* AI content indicator */}
      <div
        className="inline-block text-white text-xs px-2 py-0.5 rounded-full mb-2"
        style={{ background: 'var(--accent-9)' }}
      >
        AI Suggestion
      </div>

      {/* Content display */}
      <div className="text-sm max-h-48 overflow-y-auto">
        <AIStreamDisplay content={content} isStreaming={isStreaming} />
      </div>

      {/* Action toolbar */}
      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--gray-6)' }}>
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              onClick={onAccept}
              className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Reject
            </button>
            <span className="text-xs ml-auto" style={{ color: 'var(--gray-9)' }}>
              {originalText.length} → {content.length} chars
            </span>
          </>
        )}
      </div>
    </div>
  );
}
