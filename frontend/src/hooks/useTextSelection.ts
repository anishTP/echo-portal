import { useState, useEffect, useCallback, RefObject } from 'react';

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

/**
 * Hook for detecting text selection within a container element.
 * Returns selection info including text, character offsets, and bounding rect.
 */
export function useTextSelection(containerRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    const rect = range.getBoundingClientRect();

    // Calculate offsets relative to container text content
    const containerText = container.textContent || '';
    const startOffset = containerText.indexOf(text);

    setSelection({
      text,
      startOffset: startOffset >= 0 ? startOffset : 0,
      endOffset: startOffset >= 0 ? startOffset + text.length : text.length,
      rect,
    });
  }, [containerRef]);

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
