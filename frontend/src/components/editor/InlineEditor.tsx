import React, { useCallback, useRef, useState } from 'react';
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commandsCtx, parserCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { history, undoCommand, redoCommand } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig } from '@milkdown/plugin-upload';
import { defaultImageUploader } from './milkdown-config';
import { useVideoEmbedView } from './video-embed-plugin';
import '@milkdown/theme-nord/style.css';
import './editor.css';
import { AIContextMenu } from '../ai/AIContextMenu';
import { AIInlinePreview } from '../ai/AIInlinePreview';

export interface InlineEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readonly?: boolean;
  placeholder?: string;
  className?: string;
  /** AI transform callback (007-ai-assisted-authoring) */
  onAITransform?: (selectedText: string, instruction: string) => void;
  /** AI inline preview state */
  aiPreview?: {
    content: string;
    isStreaming: boolean;
    originalText: string;
    onAccept: () => void;
    onReject: () => void;
    onCancel?: () => void;
  } | null;
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

export interface InlineEditorHandle {
  undo: () => void;
  redo: () => void;
  /** Replace editor body via ProseMirror transaction (preserves undo history) */
  replaceBody: (markdown: string) => void;
  /** Insert markdown at the current cursor position */
  insertAtCursor: (markdown: string) => void;
}

/** Bridge component that captures the editor instance, exposes undo/redo, and tracks history state */
function EditorBridge({
  editorRef,
  onHistoryChange,
}: {
  editorRef: React.MutableRefObject<InlineEditorHandle | null>;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}) {
  const [loading, getEditor] = useInstance();
  const onHistoryChangeRef = useRef(onHistoryChange);
  onHistoryChangeRef.current = onHistoryChange;

  React.useEffect(() => {
    if (loading) return;
    const editor = getEditor();

    const getView = () => editor.action((ctx) => ctx.get(editorViewCtx));

    // Check history availability by inspecting the ProseMirror history
    // plugin state directly. We avoid importing undoDepth/redoDepth because
    // pnpm + Vite can create duplicate module instances of prosemirror-history,
    // causing the historyKey reference to mismatch.
    const checkHistory = () => {
      try {
        const view = getView();
        let canUndo = false;
        let canRedo = false;
        for (const plugin of view.state.plugins) {
          const pluginState = plugin.getState(view.state);
          if (pluginState && typeof pluginState === 'object' && 'done' in pluginState && 'undone' in pluginState) {
            const hist = pluginState as { done: { eventCount: number }; undone: { eventCount: number } };
            canUndo = hist.done.eventCount > 0;
            canRedo = hist.undone.eventCount > 0;
            break;
          }
        }
        onHistoryChangeRef.current?.(canUndo, canRedo);
      } catch { /* editor not ready */ }
    };

    editorRef.current = {
      undo: () => {
        try {
          editor.action((ctx) => ctx.get(commandsCtx).call(undoCommand.key));
          checkHistory();
        } catch { /* editor not ready */ }
      },
      redo: () => {
        try {
          editor.action((ctx) => ctx.get(commandsCtx).call(redoCommand.key));
          checkHistory();
        } catch { /* editor not ready */ }
      },
      replaceBody: (markdown: string) => {
        try {
          editor.action((ctx) => {
            const parser = ctx.get(parserCtx);
            const view = ctx.get(editorViewCtx);
            const doc = parser(markdown);
            if (doc) {
              const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
              view.dispatch(tr);
            }
          });
          checkHistory();
        } catch { /* editor not ready */ }
      },
      insertAtCursor: (markdown: string) => {
        try {
          editor.action((ctx) => {
            const parser = ctx.get(parserCtx);
            const view = ctx.get(editorViewCtx);
            const doc = parser(markdown);
            if (doc) {
              const pos = view.state.selection.from;
              const tr = view.state.tr.insert(pos, doc.content);
              view.dispatch(tr);
            }
          });
          checkHistory();
        } catch { /* editor not ready */ }
      },
    };

    checkHistory();
    const interval = setInterval(checkHistory, 300);

    return () => {
      clearInterval(interval);
      editorRef.current = null;
    };
  }, [loading, getEditor, editorRef]);

  return null;
}

/**
 * WYSIWYG inline markdown editor using Milkdown.
 * Provides Notion/Medium-style editing with live formatting.
 * Supports AI context menu for text transformation (007-ai-assisted-authoring).
 */
export function InlineEditor(props: InlineEditorProps & {
  editorRef?: React.MutableRefObject<InlineEditorHandle | null>;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}) {
  const { className = '', onAITransform, aiPreview, editorRef, onHistoryChange } = props;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  // Store selection position for the AI preview popover
  const [transformPosition, setTransformPosition] = useState<{ top: number; left: number } | null>(null);

  // Stop keyboard event propagation to prevent Vimium and other browser extensions
  // from capturing keystrokes meant for the editor
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Store the selection rect when the context menu opens
  const selectionRectRef = useRef<DOMRect | null>(null);

  // Handle right-click context menu for AI transform (FR-014)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!onAITransform) return;

      const selection = window.getSelection();
      const selectedText = selection?.toString()?.trim();
      if (!selectedText) return;

      // Capture the selection bounding rect for later positioning
      const range = selection?.getRangeAt(0);
      selectionRectRef.current = range?.getBoundingClientRect() ?? null;

      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, text: selectedText });
    },
    [onAITransform]
  );

  const handleTransform = useCallback(
    (instruction: string) => {
      if (contextMenu?.text && onAITransform) {
        // Save position from the selection rect captured on right-click
        if (selectionRectRef.current) {
          const rect = selectionRectRef.current;
          setTransformPosition({
            top: Math.min(rect.bottom + 8, window.innerHeight - 250),
            left: Math.max(16, Math.min(rect.left, window.innerWidth - 450)),
          });
        }
        onAITransform(contextMenu.text, instruction);
      }
      setContextMenu(null);
    },
    [contextMenu, onAITransform]
  );

  // Clear transform position when AI preview is dismissed
  React.useEffect(() => {
    if (!aiPreview) {
      setTransformPosition(null);
    }
  }, [aiPreview]);

  return (
    <div
      className={`inline-editor ${className}`}
      data-vimium-ignore
      onKeyDown={stopKeyPropagation}
      onKeyUp={stopKeyPropagation}
      onKeyPress={stopKeyPropagation}
      onContextMenu={handleContextMenu}
    >
      <MilkdownProvider>
        <ProsemirrorAdapterProvider>
          {editorRef && <EditorBridge editorRef={editorRef} onHistoryChange={onHistoryChange} />}
          <MilkdownEditor {...props} />
        </ProsemirrorAdapterProvider>
      </MilkdownProvider>

      {/* AI inline preview for transform results */}
      {aiPreview && (
        <AIInlinePreview
          content={aiPreview.content}
          isStreaming={aiPreview.isStreaming}
          originalText={aiPreview.originalText}
          onAccept={aiPreview.onAccept}
          onReject={aiPreview.onReject}
          onCancel={aiPreview.onCancel}
          position={transformPosition}
        />
      )}

      {/* AI context menu */}
      {contextMenu && (
        <AIContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          selectedText={contextMenu.text}
          onTransform={handleTransform}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default InlineEditor;
