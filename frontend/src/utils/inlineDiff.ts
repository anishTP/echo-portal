/**
 * inlineDiff.ts - Word-level diff computation for prose content.
 *
 * Uses the `diff` library to compute word-level differences between
 * old and new text, returning markdown with <ins>/<del> tags for highlighting.
 */

import { diffWords } from 'diff';

/**
 * Escapes HTML special characters to prevent injection when embedding
 * raw text into HTML tags.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Makes whitespace deletions visible by replacing with symbols.
 * Line breaks become visible ↵ symbols so reviewers can see what was removed.
 *
 * @param text - The text to process
 * @param isDeleted - Whether this text is being deleted
 * @returns Text with visible whitespace indicators (if deleted)
 */
function makeWhitespaceVisible(text: string, isDeleted: boolean): string {
  if (!isDeleted) return text;

  // Count line breaks in the text
  const lineBreakCount = (text.match(/\n/g) || []).length;

  // If the entire content is just whitespace/line breaks
  if (text.trim() === '' && text.length > 0) {
    if (lineBreakCount > 0) {
      // Show a visible placeholder for removed line breaks
      return `[${lineBreakCount} line break${lineBreakCount > 1 ? 's' : ''} removed]`;
    }
    // Just spaces/tabs
    return '[whitespace removed]';
  }

  // For mixed content (text + line breaks), add visible symbols
  // Replace each line break with the symbol + the actual line break
  return text.replace(/\n/g, '↵\n');
}

/**
 * Generates unified diff markdown showing both additions and deletions inline.
 * Used for unified view where both changes appear interleaved.
 *
 * @param oldText - Original content (null for new files)
 * @param newText - New content (null for deleted files)
 * @returns Markdown string with <ins> and <del> tags for highlighting
 */
export function generateUnifiedDiffMarkdown(
  oldText: string | null,
  newText: string | null
): string {
  // New file - render normally without highlighting
  if (!oldText) return newText || '';

  // Deleted file - show all content as deleted
  if (!newText) return `<del>${escapeHtml(oldText)}</del>`;

  // No changes
  if (oldText === newText) return newText;

  const diff = diffWords(oldText, newText);
  return diff
    .map((part) => {
      if (part.added) return `<ins>${escapeHtml(part.value)}</ins>`;
      if (part.removed) {
        const visible = makeWhitespaceVisible(part.value, true);
        return `<del>${escapeHtml(visible)}</del>`;
      }
      return part.value;
    })
    .join('');
}

/**
 * Generates diff markdown for the old side (left panel in split view).
 * Shows deletions highlighted, additions are omitted.
 *
 * @param oldText - Original content
 * @param newText - New content
 * @returns Markdown string with <del> tags for removed content
 */
export function generateOldSideDiffMarkdown(
  oldText: string | null,
  newText: string | null
): string {
  if (!oldText) return '';
  if (!newText) return oldText; // File was deleted, show all content
  if (oldText === newText) return oldText;

  const diff = diffWords(oldText, newText);
  return diff
    .filter((part) => !part.added) // Exclude additions
    .map((part) => {
      if (part.removed) {
        const visible = makeWhitespaceVisible(part.value, true);
        return `<del>${escapeHtml(visible)}</del>`;
      }
      return part.value;
    })
    .join('');
}

/**
 * Generates diff markdown for the new side (right panel in split view).
 * Shows additions highlighted, deletions are omitted.
 *
 * @param oldText - Original content
 * @param newText - New content
 * @returns Markdown string with <ins> tags for added content
 */
export function generateNewSideDiffMarkdown(
  oldText: string | null,
  newText: string | null
): string {
  if (!newText) return '';
  if (!oldText) return newText; // New file, show all content
  if (oldText === newText) return newText;

  const diff = diffWords(oldText, newText);
  return diff
    .filter((part) => !part.removed) // Exclude deletions
    .map((part) => {
      if (part.added) return `<ins>${escapeHtml(part.value)}</ins>`;
      return part.value;
    })
    .join('');
}
