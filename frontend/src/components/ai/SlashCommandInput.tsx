import { useRef, useCallback, useEffect } from 'react';

const SLASH_RE = /^(\/(?:replace|analyse|analyze|add))\s/;

interface SlashCommandInputProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * SlashCommandInput — contentEditable div that highlights slash command prefixes inline.
 *
 * Renders the recognised command portion (`/replace`, `/analyse`, etc.) in a styled
 * monospace badge while keeping the rest as plain text. Uses Selection/Range API
 * to preserve cursor position across innerHTML updates.
 */
export function SlashCommandInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  placeholder,
  disabled = false,
}: SlashCommandInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  // Track whether we're doing a programmatic innerHTML update to avoid re-entrant onInput
  const suppressInput = useRef(false);

  /**
   * Compute the character offset of the caret inside the contentEditable.
   * Walks text nodes to sum up character counts.
   */
  const getCaretOffset = useCallback((): number => {
    const el = editorRef.current;
    if (!el) return 0;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(el);
    range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return range.toString().length;
  }, []);

  /**
   * Restore the caret to a specific character offset inside the contentEditable.
   */
  const setCaretOffset = useCallback((offset: number) => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel) return;

    let remaining = offset;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }

    // If offset exceeds content length, place at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  /**
   * Build the innerHTML for the current text value, styling the slash command
   * prefix when present.
   */
  const buildHTML = useCallback((text: string): string => {
    if (!text) return '';
    const match = text.match(SLASH_RE);
    if (!match) return escapeHTML(text);

    const cmd = match[1];
    const rest = text.slice(match[0].length);
    return (
      `<span class="slash-cmd" style="` +
      `display:inline;` +
      `font-family:var(--font-mono,ui-monospace,monospace);` +
      `font-size:0.75rem;` +
      `font-weight:600;` +
      `padding:1px 6px;` +
      `border-radius:4px;` +
      `background:var(--accent-a3,rgba(0,100,255,0.1));` +
      `color:var(--accent-11,#3b82f6);` +
      `margin-right:4px` +
      `">${escapeHTML(cmd)}</span>${escapeHTML(' ' + rest)}`
    );
  }, []);

  /**
   * Sync the contentEditable's innerHTML to reflect the current value,
   * preserving the caret position.
   */
  const syncDOM = useCallback(
    (text: string) => {
      const el = editorRef.current;
      if (!el) return;

      const caretPos = getCaretOffset();
      const html = buildHTML(text);

      if (el.innerHTML !== html) {
        suppressInput.current = true;
        el.innerHTML = html;
        // Restore caret after innerHTML swap
        setCaretOffset(caretPos);
        suppressInput.current = false;
      }
    },
    [buildHTML, getCaretOffset, setCaretOffset]
  );

  // Sync DOM whenever value changes from outside (e.g. parent clears it)
  useEffect(() => {
    syncDOM(value);
  }, [value, syncDOM]);

  const handleInput = useCallback(() => {
    if (suppressInput.current || isComposing.current) return;
    const el = editorRef.current;
    if (!el) return;

    const text = el.textContent ?? '';
    onChange(text);

    // Re-render with highlighting if the slash prefix changed
    syncDOM(text);
  }, [onChange, syncDOM]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      // execCommand is deprecated but is the simplest way to insert text
      // into a contentEditable while preserving undo history.
      // Falls back to direct textContent manipulation if unavailable (e.g. jsdom).
      if (typeof document.execCommand === 'function') {
        document.execCommand('insertText', false, text);
      } else {
        const el = editorRef.current;
        if (el) {
          el.textContent = (el.textContent ?? '') + text;
          onChange(el.textContent);
          syncDOM(el.textContent);
        }
      }
    },
    [onChange, syncDOM]
  );

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
    // Fire a synthetic input so we pick up the composed text
    handleInput();
  }, [handleInput]);

  return (
    <div
      ref={editorRef}
      role="textbox"
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={onFocus}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className={`flex-1 px-2 py-1.5 text-sm focus:outline-none slash-command-input${disabled ? ' opacity-50 pointer-events-none' : ''}`}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--gray-12)',
        minHeight: '2rem',
        maxHeight: '5rem',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    />
  );
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
