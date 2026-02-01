import React, { useCallback, useRef } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig } from '@milkdown/plugin-upload';
import { defaultImageUploader } from './milkdown-config';
import { useVideoEmbedView } from './video-embed-plugin';
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
}: InlineEditorProps) {
  // Store the initial value in a ref so it doesn't change on re-renders
  // This prevents the editor from being recreated on every keystroke
  const initialValueRef = useRef(defaultValue);

  // Store onChange in a ref to avoid recreating the editor when the callback changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Get the video embed view plugin (uses useNodeViewFactory internally)
  const videoEmbedView = useVideoEmbedView();

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialValueRef.current);

        // Use ref for onChange to avoid dependency issues
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChangeRef.current?.(markdown);
        });

        // Configure upload plugin for drag-and-drop and paste image handling
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: defaultImageUploader,
          enableHtmlFileUploader: true,
        }));
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(upload)
      .use(videoEmbedView),
    [] // Empty dependency - videoEmbedView is memoized and stable
  );

  return <Milkdown />;
}

/**
 * WYSIWYG inline markdown editor using Milkdown.
 * Provides Notion/Medium-style editing with live formatting.
 */
export function InlineEditor(props: InlineEditorProps) {
  const { className = '' } = props;

  // Stop keyboard event propagation to prevent Vimium and other browser extensions
  // from capturing keystrokes meant for the editor
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`inline-editor ${className}`}
      data-vimium-ignore
      onKeyDown={stopKeyPropagation}
      onKeyUp={stopKeyPropagation}
      onKeyPress={stopKeyPropagation}
    >
      <MilkdownProvider>
        <ProsemirrorAdapterProvider>
          <MilkdownEditor {...props} />
        </ProsemirrorAdapterProvider>
      </MilkdownProvider>
    </div>
  );
}

export default InlineEditor;
