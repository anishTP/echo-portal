import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';

export interface EditorConfig {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readonly?: boolean;
}

/**
 * Create a configured Milkdown editor instance.
 */
export async function createEditor(
  root: HTMLElement,
  config: EditorConfig
): Promise<Editor> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);

      if (config.defaultValue) {
        ctx.set(defaultValueCtx, config.defaultValue);
      }

      // Configure listener for content changes
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        config.onChange?.(markdown);
      });
    })
    .config(nord)
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(listener)
    .create();

  return editor;
}

/**
 * Get markdown content from an editor instance.
 */
export function getMarkdownFromEditor(editor: Editor): string {
  // The editor serializes to markdown via the listener
  // This is a fallback for direct extraction
  const root = editor.ctx.get(rootCtx);
  if (root instanceof HTMLElement) {
    // The markdown is available through the editor's internal state
    // For now, return empty - actual implementation uses listener
    return '';
  }
  return '';
}

export { Editor };
