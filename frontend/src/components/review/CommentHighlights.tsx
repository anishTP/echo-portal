/**
 * CommentHighlights - Renders visual highlights over text that has comments.
 *
 * Shows amber/yellow background on commented text and displays a small
 * comment indicator icon at the end of each highlighted range.
 */

import { useState, useEffect, useCallback, useMemo, RefObject } from 'react';
import type { ReviewComment } from '../../services/reviewService';
import { CommentViewPopover } from './CommentViewPopover';
import styles from './CommentHighlights.module.css';

interface CommentHighlightsProps {
  /** Comments that may have selection data for highlighting */
  comments: ReviewComment[];
  /** Reference to the container element containing the commentable text */
  containerRef: RefObject<HTMLElement | null>;
  /** Callback when a comment indicator is clicked */
  onCommentClick?: (comment: ReviewComment) => void;
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

type HighlightContext = 'default' | 'addition' | 'deletion';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Context for styling - whether this rect is over addition/deletion/normal text */
  context: HighlightContext;
}

interface HighlightPosition {
  comment: ReviewComment;
  /** Bounding rects for the highlighted text (may span multiple lines) */
  rects: Rect[];
  /** Position for the indicator icon (end of last rect) */
  indicatorPosition: { top: number; left: number };
  /** Primary context for the indicator icon */
  context: HighlightContext;
}

/**
 * Detects if an element or its ancestors have addition/deletion styling
 */
function detectHighlightContext(element: Element | null): HighlightContext {
  let current = element;
  while (current) {
    const classList = current.classList;
    // Check for common diff highlight class patterns
    if (classList) {
      for (const className of classList) {
        if (className.includes('Addition') || className.includes('addition')) {
          return 'addition';
        }
        if (className.includes('Deletion') || className.includes('deletion')) {
          return 'deletion';
        }
      }
    }
    current = current.parentElement;
  }
  return 'default';
}

/**
 * Finds a text node and offset within a container that corresponds to
 * a character offset in the container's text content.
 */
function findTextNodeAtOffset(
  container: HTMLElement,
  targetOffset: number
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength >= targetOffset) {
      return {
        node,
        offset: targetOffset - currentOffset,
      };
    }
    currentOffset += nodeLength;
    node = walker.nextNode() as Text | null;
  }

  return null;
}

/**
 * Gets the bounding rects for a text range within a container,
 * along with the context (addition/deletion/default) for each rect.
 */
function getRangeRectsWithContext(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
): { rects: DOMRect[]; context: HighlightContext } {
  const start = findTextNodeAtOffset(container, startOffset);
  const end = findTextNodeAtOffset(container, endOffset);

  if (!start || !end) return { rects: [], context: 'default' };

  try {
    const range = document.createRange();
    range.setStart(start.node, Math.min(start.offset, start.node.length));
    range.setEnd(end.node, Math.min(end.offset, end.node.length));

    // Detect context from the start node's parent element
    const context = detectHighlightContext(start.node.parentElement);

    // getClientRects() returns multiple rects if text spans lines
    const clientRects = range.getClientRects();
    return { rects: Array.from(clientRects), context };
  } catch {
    return { rects: [], context: 'default' };
  }
}

export function CommentHighlights({
  comments,
  containerRef,
  onCommentClick,
  currentUserId,
  branchAuthorId,
  onResolve,
  onUnresolve,
  onReply,
}: CommentHighlightsProps) {
  const [highlights, setHighlights] = useState<HighlightPosition[]>([]);
  const [selectedComment, setSelectedComment] = useState<ReviewComment | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  // Memoize root comments (non-replies) to avoid recalculating highlights when only replies change
  const rootComments = useMemo(
    () => comments.filter(c => !c.parentId),
    [comments]
  );

  // Calculate highlight positions based on comments with selection data
  const calculateHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newHighlights: HighlightPosition[] = [];

    // Filter root comments that have valid selection data
    const selectionComments = rootComments.filter(
      (c) => c.selectedText &&
             typeof c.startOffset === 'number' &&
             typeof c.endOffset === 'number' &&
             c.startOffset >= 0 &&
             c.endOffset > c.startOffset
    );

    for (const comment of selectionComments) {
      const { rects, context } = getRangeRectsWithContext(
        container,
        comment.startOffset!,
        comment.endOffset!
      );

      // Filter out invalid rects (zero dimensions or negative positions)
      const validRects = rects.filter(
        rect => rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0
      );

      if (validRects.length > 0) {
        // Calculate positions relative to container
        const relativeRects = validRects.map((rect) => ({
          top: rect.top - containerRect.top + container.scrollTop,
          left: rect.left - containerRect.left + container.scrollLeft,
          width: rect.width,
          height: rect.height,
          context, // Same context for all rects in this range
        }));

        // Additional validation: skip if positions are unreasonable
        const hasValidPositions = relativeRects.every(
          r => r.top >= 0 && r.left >= 0 && r.width > 0 && r.height > 0
        );
        if (!hasValidPositions) continue;

        // Position indicator at end of the line (right edge of container)
        const lastRect = relativeRects[relativeRects.length - 1];
        const indicatorPosition = {
          top: lastRect.top + (lastRect.height / 2), // Vertically center on the line
          left: containerRect.width - 16, // Position near right edge with some padding
        };

        newHighlights.push({
          comment,
          rects: relativeRects,
          indicatorPosition,
          context,
        });
      }
    }

    setHighlights(newHighlights);
  }, [rootComments, containerRef]);

  // Recalculate on mount and when comments change
  useEffect(() => {
    // Use requestAnimationFrame to ensure the DOM is fully painted
    // This is important when markdown content is being rendered
    const rafId = requestAnimationFrame(() => {
      calculateHighlights();
    });

    // Recalculate on window resize
    const handleResize = () => calculateHighlights();
    window.addEventListener('resize', handleResize);

    // Also observe container for scroll changes
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', calculateHighlights);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      if (container) {
        container.removeEventListener('scroll', calculateHighlights);
      }
    };
  }, [calculateHighlights, containerRef]);

  const handleIndicatorClick = (highlight: HighlightPosition, event: React.MouseEvent) => {
    event.stopPropagation();

    // Position popover to the right of the icon, outside the content area
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setPopoverPosition({
      top: rect.top,
      left: rect.right + 12, // Position to the right of the icon
    });
    setSelectedComment(highlight.comment);
    onCommentClick?.(highlight.comment);
  };

  const handleClosePopover = () => {
    setSelectedComment(null);
    setPopoverPosition(null);
  };

  // Close popover when clicking outside
  useEffect(() => {
    if (!selectedComment) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check for data attribute on popover or indicator class
      if (!target.closest('[data-comment-popover]') && !target.closest(`.${styles.indicator}`)) {
        handleClosePopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedComment]);

  if (highlights.length === 0) return null;

  return (
    <>
      {/* Highlight overlays */}
      {highlights.map((highlight) => (
        <div key={highlight.comment.id} className={styles.highlightGroup}>
          {/* Background highlights for each rect */}
          {highlight.rects.map((rect, i) => (
            <div
              key={i}
              className={`${styles.highlight} ${styles[`highlight--${rect.context}`]}`}
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              }}
            />
          ))}

          {/* Comment indicator icon - chat bubble with lines */}
          <button
            type="button"
            className={`${styles.indicator} ${styles[`indicator--${highlight.context}`]}`}
            style={{
              top: highlight.indicatorPosition.top,
              left: highlight.indicatorPosition.left,
            }}
            onClick={(e) => handleIndicatorClick(highlight, e)}
            title="View comment"
            aria-label="View comment"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              {/* Chat bubble outline */}
              <path fillRule="evenodd" clipRule="evenodd" d="M2 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-4.586l-3.707 3.707A1 1 0 0 1 5 18v-3H5a3 3 0 0 1-3-3V5Zm3-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2v2.586l2.293-2.293A1 1 0 0 1 8 13h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5Z" />
              {/* Text lines inside */}
              <path d="M6 6h8v1.5H6V6Zm0 3h5v1.5H6V9Z" />
            </svg>
          </button>
        </div>
      ))}

      {/* Comment view popover */}
      {selectedComment && popoverPosition && (
        <CommentViewPopover
          comment={selectedComment}
          replies={comments.filter(c => c.parentId === selectedComment.id)}
          position={popoverPosition}
          onClose={handleClosePopover}
          currentUserId={currentUserId}
          branchAuthorId={branchAuthorId}
          onResolve={onResolve}
          onUnresolve={onUnresolve}
          onReply={onReply}
        />
      )}
    </>
  );
}

export default CommentHighlights;
