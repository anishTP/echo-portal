import { useState, useEffect, useCallback, RefObject } from 'react';

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

/**
 * Calculates the character offset of a node/offset pair relative to a container's text content.
 * Walks through all text nodes in the container and counts characters until reaching the target.
 */
function getCharacterOffset(container: HTMLElement, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;

  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += node.textContent?.length || 0;
    node = walker.nextNode();
  }

  // If the target node wasn't found directly, it might be an element node
  // In that case, find the text node at the given offset
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const childNodes = targetNode.childNodes;
    if (targetOffset < childNodes.length) {
      const child = childNodes[targetOffset];
      if (child.nodeType === Node.TEXT_NODE) {
        return getCharacterOffset(container, child, 0);
      }
    }
  }

  return offset;
}

/**
 * Hook for detecting text selection within a container element.
 * Returns selection info including text, character offsets, and bounding rect.
 */
export function useTextSelection(containerRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    // Don't clear selection if clicking inside a popover or form element
    // This prevents the selection from being cleared when submitting a comment
    const target = event.target as HTMLElement;
    const isInsidePopover = target.closest('[data-comment-popover]');
    const isFormElement = target.closest('button, input, textarea, [role="button"]');

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      // Only clear if NOT clicking inside a comment popover or form element
      if (!isInsidePopover && !isFormElement) {
        setSelection(null);
      }
      return;
    }

    // Access .current at call time, not at callback creation time
    const container = containerRef.current;
    if (!container) return;

    const range = sel.getRangeAt(0);

    // Check both start and end containers (more robust than commonAncestorContainer)
    const startInContainer = container.contains(range.startContainer);
    const endInContainer = container.contains(range.endContainer);

    if (!startInContainer || !endInContainer) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    const rect = range.getBoundingClientRect();

    // Calculate offsets by walking the DOM tree
    // This gives us the exact character position, not just the first occurrence
    const startOffset = getCharacterOffset(container, range.startContainer, range.startOffset);
    const endOffset = getCharacterOffset(container, range.endContainer, range.endOffset);

    setSelection({
      text,
      startOffset,
      endOffset,
      rect,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef is a stable ref object; we intentionally read .current at call time
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return { selection, clearSelection };
}
