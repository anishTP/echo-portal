import React, { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { InlineEditor } from '../editor/InlineEditor';
import { EditorStatusBar } from '../editor/EditorStatusBar';
import { InlineMetadataHeader } from './InlineMetadataHeader';
import { InlineTagsEditor } from './InlineTagsEditor';
import { useAutoSave, type DraftContent } from '../../hooks/useAutoSave';
import { useEditSession } from '../../hooks/useEditSession';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../hooks/useAuth';
import type { ContentDetail } from '@echo-portal/shared';
import styles from './InlineEditView.module.css';

export interface InlineEditViewHandle {
  /** Get the current draft content */
  getContent: () => DraftContent;
  /** Save the current content immediately */
  saveNow: () => Promise<void>;
  /** Cancel any pending debounced saves */
  cancelPendingSave: () => void;
}

export interface InlineEditViewProps {
  /** Content being edited */
  content: ContentDetail;
  /** Branch ID for the edit branch */
  branchId: string;
  /** Branch name for display */
  branchName: string;
  /** Current title from parent */
  title?: string;
  /** Current category from parent */
  category?: string;
  /** Current description from parent */
  description?: string;
  /** Current tags from parent */
  tags?: string[];
  /** Callback when title changes */
  onTitleChange?: (title: string) => void;
  /** Callback when category changes */
  onCategoryChange?: (category: string) => void;
  /** Callback when description changes */
  onDescriptionChange?: (description: string) => void;
  /** Callback when tags change */
  onTagsChange?: (tags: string[]) => void;
  /** Callback when user requests to exit edit mode */
  onExitEditMode?: () => void;
  /** CSS class name */
  className?: string;
}

/**
 * Inline editor view for the Library page.
 * Wraps InlineEditor with auto-save, sync, and session tracking.
 */
const InlineEditViewComponent = forwardRef<InlineEditViewHandle, InlineEditViewProps>(
  function InlineEditViewComponent({
    content,
    branchId,
    branchName,
    title: propTitle,
    category: propCategory,
    description: propDescription,
    tags: propTags,
    onTitleChange,
    onCategoryChange,
    onDescriptionChange,
    onTagsChange,
    className = '',
  }, ref) {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const editorRef = useRef<HTMLDivElement>(null);

  // Use ref to track content without triggering re-renders
  // This prevents any state updates from causing focus loss
  const contentRef = useRef<DraftContent>({
    title: propTitle ?? content.title,
    body: content.currentVersion?.body || '',
    metadata: {
      category: propCategory ?? content.category,
      tags: propTags ?? content.tags,
      description: propDescription ?? content.description,
    },
  });

  // Derived values for display (use props if available, otherwise from content)
  const displayTitle = propTitle ?? content.title;
  const displayCategory = propCategory ?? content.category ?? '';
  const displayDescription = propDescription ?? content.description ?? '';
  const displayTags = propTags ?? content.tags ?? [];

  // Initial value for the editor (only used on mount)
  const initialBody = useRef(content.currentVersion?.body || '');

  // Self-contained auto-save - no callbacks to parent, no state sync issues
  const { state: autoSaveState, save: autoSaveFn, saveNow, loadDraft, cancel: cancelAutoSave } = useAutoSave({
    contentId: content.id,
    branchId,
  });

  // Edit session tracking
  const editSession = useEditSession({
    contentId: content.id,
    branchId,
    userId: user?.id || '',
  });

  // Load existing draft on mount
  useEffect(() => {
    const initializeDraft = async () => {
      const existingDraft = await loadDraft();
      if (existingDraft) {
        contentRef.current = {
          title: existingDraft.title,
          body: existingDraft.body,
          metadata: existingDraft.metadata,
        };
        // Update initial body ref for the editor
        initialBody.current = existingDraft.body;
      }
    };

    initializeDraft();
    editSession.startSession();

    return () => {
      editSession.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount/unmount
  }, [content.id, branchId]);

  // Handle body changes from editor - use ref to avoid re-renders
  const handleBodyChange = useCallback(
    (markdown: string) => {
      contentRef.current = { ...contentRef.current, body: markdown };
      autoSaveFn(contentRef.current);
    },
    [autoSaveFn]
  );

  // Handle Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow(contentRef.current);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveNow]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getContent: () => contentRef.current,
    saveNow: async () => {
      await saveNow(contentRef.current);
    },
    cancelPendingSave: () => {
      cancelAutoSave();
    },
  }), [saveNow, cancelAutoSave]);

  // Record activity on editor focus
  const handleEditorFocus = useCallback(() => {
    editSession.recordActivity();
  }, [editSession]);

  // Stop keyboard event propagation to prevent Vimium and other extensions from capturing keystrokes
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`${styles.container} ${className}`}
      ref={editorRef}
      data-vimium-ignore
      onKeyDown={stopKeyPropagation}
      onKeyUp={stopKeyPropagation}
    >
      <article className={styles.article}>
        {/* Inline metadata header: category, title, description */}
        <InlineMetadataHeader
          category={displayCategory}
          title={displayTitle}
          description={displayDescription}
          onCategoryChange={onCategoryChange ?? (() => {})}
          onTitleChange={onTitleChange ?? (() => {})}
          onDescriptionChange={onDescriptionChange ?? (() => {})}
        />

        {/* Editor for body content */}
        <div className={styles.editorWrapper}>
          <InlineEditor
            defaultValue={initialBody.current}
            onChange={handleBodyChange}
            onFocus={handleEditorFocus}
          />
        </div>

        {/* Inline tags editor in footer */}
        <InlineTagsEditor
          tags={displayTags}
          onTagsChange={onTagsChange ?? (() => {})}
        />
      </article>

      <EditorStatusBar
        saveStatus={autoSaveState.status}
        syncStatus="idle"
        isOnline={isOnline}
        branchName={branchName}
        versionNumber={autoSaveState.localVersion}
        pendingSyncCount={0}
        lastSyncedAt={null}
        className={styles.statusBar}
      />
    </div>
  );
});

// Memoize to prevent re-renders from parent state changes
export const InlineEditView = React.memo(InlineEditViewComponent);

// Export helpers for parent component to use
export type { DraftContent };

export default InlineEditView;
