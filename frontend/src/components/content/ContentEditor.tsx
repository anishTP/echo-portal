import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, TextArea, TextField, Callout, SegmentedControl, Box } from '@radix-ui/themes';
import { ArchiveIcon } from '@radix-ui/react-icons';
import { ContentTypeSelector } from './ContentTypeSelector';
import { ContentMetadata } from './ContentMetadata';
import { DeleteContentDialog } from './DeleteContentDialog';
import { InlineEditor } from '../editor/InlineEditor';
import { EditorStatusBar } from '../editor/EditorStatusBar';
import { DraftRecoveryBanner } from '../editor/DraftRecoveryBanner';
import { SaveDraftDialog } from '../editor/SaveDraftDialog';
import { AIChatPanel } from '../ai/AIChatPanel';
import { useContentStore } from '../../stores/contentStore';
import { useCreateContent, useUpdateContent, useDeleteContent } from '../../hooks/useContent';
import { useAutoSave, type DraftContent } from '../../hooks/useAutoSave';
import { useDraftSync } from '../../hooks/useDraftSync';
import { useEditSession } from '../../hooks/useEditSession';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAIStore } from '../../stores/aiStore';
import type { ContentTypeValue, ContentDetail } from '@echo-portal/shared';
import type { Draft } from '../../services/draft-db';

type EditorMode = 'wysiwyg' | 'markdown';

interface ContentEditorProps {
  branchId: string;
  branchName?: string;
  content?: ContentDetail | null;
  onSave?: (content: ContentDetail) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  defaultEditorMode?: EditorMode;
  /** Enable auto-save to IndexedDB (default: true for editing) */
  enableAutoSave?: boolean;
  /** User ID for session tracking */
  userId?: string;
}

export function ContentEditor({
  branchId,
  branchName,
  content,
  onSave,
  onCancel,
  onDelete,
  defaultEditorMode = 'wysiwyg',
  enableAutoSave = true,
  userId,
}: ContentEditorProps) {
  const [title, setTitle] = useState(content?.title ?? '');
  const [contentType, setContentType] = useState<ContentTypeValue>(
    content?.contentType ?? 'guideline'
  );
  const [category, setCategory] = useState(content?.category ?? '');
  const [tags, setTags] = useState<string[]>(content?.tags ?? []);
  const [description, setDescription] = useState(content?.description ?? '');
  const [body, setBody] = useState(content?.currentVersion?.body ?? '');
  const [changeDescription, setChangeDescription] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(defaultEditorMode);
  const [recoveredDraft, setRecoveredDraft] = useState<Draft | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showSaveDraftDialog, setShowSaveDraftDialog] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const initializedRef = useRef(false);

  const setIsDirty = useContentStore((s) => s.setIsDirty);
  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent(content?.id ?? '');
  const deleteMutation = useDeleteContent(branchId);

  const isEditing = !!content;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const contentId = content?.id ?? 'new';

  // Online status
  const { isOnline } = useOnlineStatus();

  // Auto-save hook (only for editing existing content)
  const autoSave = useAutoSave({
    contentId,
    branchId,
    delay: 2000,
    onSave: () => {
      // Trigger server sync after local save
      if (isEditing && enableAutoSave) {
        draftSync.sync('Auto-saved changes');
      }
    },
  });

  // Server sync hook
  const draftSync = useDraftSync({
    contentId,
    branchId,
    onSync: (result) => {
      if (result.newVersionTimestamp) {
        autoSave.markSynced(result.newVersionTimestamp);
      }
    },
    onConflict: (conflict) => {
      // For now, show conflict in console. TODO: Add conflict resolution UI
      console.warn('Sync conflict detected:', conflict);
    },
  });

  // Edit session tracking
  const editSession = useEditSession({
    contentId,
    branchId,
    userId: userId ?? 'anonymous',
    onStaleSession: (sessions) => {
      console.log('Stale sessions detected:', sessions);
    },
  });

  // Load existing draft and start session on mount
  useEffect(() => {
    if (!initializedRef.current && isEditing && enableAutoSave) {
      initializedRef.current = true;

      // Check for recovered draft
      autoSave.loadDraft().then((draft) => {
        if (draft && !draft.synced) {
          // Found unsynced draft - offer recovery
          setRecoveredDraft(draft);
        }
      });

      // Start edit session
      editSession.startSession();
    }

    return () => {
      if (isEditing) {
        editSession.endSession();
      }
    };
  }, [isEditing, enableAutoSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle draft restore
  const handleRestoreDraft = useCallback(() => {
    if (recoveredDraft) {
      setIsRestoring(true);
      setTitle(recoveredDraft.title);
      setBody(recoveredDraft.body);
      if (recoveredDraft.metadata.category) setCategory(recoveredDraft.metadata.category);
      if (recoveredDraft.metadata.tags) setTags(recoveredDraft.metadata.tags);
      if (recoveredDraft.metadata.description) setDescription(recoveredDraft.metadata.description);
      setRecoveredDraft(null);
      setIsRestoring(false);
    }
  }, [recoveredDraft]);

  // Handle draft discard
  const handleDiscardDraft = useCallback(() => {
    setRecoveredDraft(null);
  }, []);

  // Handle manual save draft with change description
  const handleSaveDraft = useCallback(async (changeDescription: string) => {
    if (!isEditing || !enableAutoSave) return;

    setIsSavingDraft(true);
    setSaveDraftError(null);

    try {
      // First, ensure current content is saved to IndexedDB
      const draftContent: DraftContent = {
        title,
        body,
        metadata: {
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          description: description || undefined,
        },
      };
      await autoSave.saveNow(draftContent);

      // Then sync to server with the custom change description
      const result = await draftSync.sync(changeDescription);

      if (result?.success) {
        setShowSaveDraftDialog(false);
      } else if (result?.conflict) {
        setSaveDraftError('Conflict detected. Please resolve before saving.');
      }
    } catch (err) {
      setSaveDraftError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  }, [isEditing, enableAutoSave, title, body, category, tags, description, autoSave, draftSync]);

  // Track dirty state and trigger auto-save
  useEffect(() => {
    const isDirty = isEditing
      ? body !== (content?.currentVersion?.body ?? '')
      : body.length > 0 || title.length > 0;
    setIsDirty(isDirty);

    // Auto-save when content changes (only for editing existing content)
    if (isEditing && enableAutoSave && isDirty && title && body) {
      const draftContent: DraftContent = {
        title,
        body,
        metadata: {
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          description: description || undefined,
        },
      };
      autoSave.save(draftContent);

      // Record activity for session tracking
      editSession.recordActivity();
    }
  }, [body, title, category, tags, description, content, isEditing, enableAutoSave, setIsDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!title.trim() || !body.trim() || !changeDescription.trim()) return;

    try {
      let result: ContentDetail;
      if (isEditing) {
        result = await updateMutation.mutateAsync({
          title,
          category: category || undefined,
          tags,
          description: description || undefined,
          body,
          changeDescription,
          currentVersionTimestamp: content?.currentVersion?.versionTimestamp,
        });
      } else {
        result = await createMutation.mutateAsync({
          branchId,
          title,
          contentType,
          category: category || undefined,
          tags,
          description: description || undefined,
          body,
          changeDescription,
        });
      }
      setIsDirty(false);
      onSave?.(result);
    } catch {
      // Error handled by React Query
    }
  }, [
    title,
    body,
    changeDescription,
    isEditing,
    content,
    branchId,
    contentType,
    category,
    tags,
    description,
    createMutation,
    updateMutation,
    setIsDirty,
    onSave,
  ]);

  const canSave = title.trim() && body.trim() && changeDescription.trim() && !isSaving;

  const handleDelete = useCallback(async () => {
    if (!content?.id) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(content.id);
      setShowDeleteDialog(false);
      setIsDirty(false);
      onDelete?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete content');
    }
  }, [content?.id, deleteMutation, setIsDirty, onDelete]);

  return (
    <div className="space-y-6">
      {/* Draft recovery banner */}
      {recoveredDraft && (
        <DraftRecoveryBanner
          draft={recoveredDraft}
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
          isRestoring={isRestoring}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Edit Content' : 'New Content'}
        </h2>
        <div className="flex gap-2">
          {isEditing && (
            <Button color="red" variant="outline" onClick={() => setShowDeleteDialog(true)}>
              Delete
            </Button>
          )}
          {isEditing && enableAutoSave && (
            <Button
              variant="outline"
              onClick={() => {
                setSaveDraftError(null);
                setShowSaveDraftDialog(true);
              }}
            >
              <ArchiveIcon />
              Save Draft
            </Button>
          )}
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Content'}
          </Button>
        </div>
      </div>

      {isEditing && (
        <DeleteContentDialog
          contentTitle={content?.title ?? ''}
          isOpen={showDeleteDialog}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      {isEditing && enableAutoSave && (
        <SaveDraftDialog
          isOpen={showSaveDraftDialog}
          onClose={() => setShowSaveDraftDialog(false)}
          onSave={handleSaveDraft}
          hasChanges={autoSave.state.isDirty || !draftSync.state.status.includes('synced')}
          isSaving={isSavingDraft}
          error={saveDraftError}
        />
      )}

      {!isEditing && (
        <ContentTypeSelector value={contentType} onChange={setContentType} />
      )}

      <ContentMetadata
        title={title}
        category={category}
        tags={tags}
        description={description}
        onTitleChange={setTitle}
        onCategoryChange={setCategory}
        onTagsChange={setTags}
        onDescriptionChange={setDescription}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="content-body" className="block text-sm font-medium">
            Content Body <span className="text-red-500">*</span>
          </label>
          <SegmentedControl.Root
            value={editorMode}
            onValueChange={(value) => setEditorMode(value as EditorMode)}
            size="1"
          >
            <SegmentedControl.Item value="wysiwyg">WYSIWYG</SegmentedControl.Item>
            <SegmentedControl.Item value="markdown">Markdown</SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>

        <div className="flex gap-0">
          <div className="flex-1 min-w-0">
            {editorMode === 'wysiwyg' ? (
              <InlineEditor
                defaultValue={body}
                onChange={setBody}
                placeholder="Start writing..."
              />
            ) : (
              <TextArea
                id="content-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={20}
                placeholder="Write your content in Markdown..."
                style={{ fontFamily: 'monospace' }}
              />
            )}
          </div>
          {/* AI Chat Panel (007-ai-assisted-authoring) */}
          <AIChatPanel
            branchId={branchId}
            contentId={content?.id}
            onContentAccepted={(aiContent) => {
              setBody(aiContent);
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="change-description" className="block text-sm font-medium mb-1">
          Change Description <span className="text-red-500">*</span>
        </label>
        <TextField.Root
          id="change-description"
          value={changeDescription}
          onChange={(e) => setChangeDescription(e.target.value)}
          maxLength={2000}
          placeholder="Describe what changed and why"
        />
      </div>

      {(createMutation.error || updateMutation.error) && (
        <Callout.Root color="red">
          <Callout.Text>
            {(createMutation.error || updateMutation.error)?.message || 'An error occurred'}
          </Callout.Text>
        </Callout.Root>
      )}

      {/* Editor status bar (only for editing with auto-save) */}
      {isEditing && enableAutoSave && (
        <Box mt="4">
          <EditorStatusBar
            saveStatus={autoSave.state.status}
            syncStatus={draftSync.state.status}
            isOnline={isOnline}
            branchName={branchName}
            versionNumber={autoSave.state.localVersion || undefined}
            pendingSyncCount={draftSync.state.queuedItems}
            lastSyncedAt={draftSync.state.lastSyncAt ? new Date(draftSync.state.lastSyncAt) : null}
          />
        </Box>
      )}
    </div>
  );
}

export default ContentEditor;
