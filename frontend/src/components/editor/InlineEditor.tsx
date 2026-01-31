import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import '@milkdown/theme-nord/style.css';
import './editor.css';

export interface InlineEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readonly?: boolean;
  placeholder?: string;
  className?: string;
}

function MilkdownEditor({
  defaultValue = '',
  onChange,
  readonly = false,
}: InlineEditorProps) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);

        if (onChange) {
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            onChange(markdown);
          });
        }
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener),
    [defaultValue]
  );

  return <Milkdown />;
}

/**
 * WYSIWYG inline markdown editor using Milkdown.
 * Provides Notion/Medium-style editing with live formatting.
 */
export function InlineEditor(props: InlineEditorProps) {
  const { className = '' } = props;

  return (
    <div className={`inline-editor ${className}`}>
      <MilkdownProvider>
        <MilkdownEditor {...props} />
      </MilkdownProvider>
    </div>
  );
}

export default InlineEditor;
