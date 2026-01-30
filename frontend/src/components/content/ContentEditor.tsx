import { useState, useCallback, useEffect } from 'react';
import { Button, TextArea, TextField, Callout } from '@radix-ui/themes';
import { ContentTypeSelector } from './ContentTypeSelector';
import { ContentMetadata } from './ContentMetadata';
import { DeleteContentDialog } from './DeleteContentDialog';
import { useContentStore } from '../../stores/contentStore';
import { useCreateContent, useUpdateContent, useDeleteContent } from '../../hooks/useContent';
import type { ContentTypeValue, ContentDetail } from '@echo-portal/shared';

interface ContentEditorProps {
  branchId: string;
  content?: ContentDetail | null;
  onSave?: (content: ContentDetail) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

export function ContentEditor({ branchId, content, onSave, onCancel, onDelete }: ContentEditorProps) {
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

  const setIsDirty = useContentStore((s) => s.setIsDirty);
  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent(content?.id ?? '');
  const deleteMutation = useDeleteContent(branchId);

  const isEditing = !!content;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // Track dirty state
  useEffect(() => {
    const isDirty = isEditing
      ? body !== (content?.currentVersion?.body ?? '')
      : body.length > 0 || title.length > 0;
    setIsDirty(isDirty);
  }, [body, title, content, isEditing, setIsDirty]);

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
        <label htmlFor="content-body" className="block text-sm font-medium mb-1">
          Content Body <span className="text-red-500">*</span>
        </label>
        <TextArea
          id="content-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={20}
          placeholder="Write your content in Markdown..."
          style={{ fontFamily: 'monospace' }}
        />
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
    </div>
  );
}

export default ContentEditor;
