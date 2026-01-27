import { useState, useCallback, useEffect } from 'react';
import { ContentTypeSelector } from './ContentTypeSelector';
import { ContentMetadata } from './ContentMetadata';
import { useContentStore } from '../../stores/contentStore';
import { useCreateContent, useUpdateContent } from '../../hooks/useContent';
import type { ContentTypeValue, ContentDetail } from '@echo-portal/shared';

interface ContentEditorProps {
  branchId: string;
  content?: ContentDetail | null;
  onSave?: (content: ContentDetail) => void;
  onCancel?: () => void;
}

export function ContentEditor({ branchId, content, onSave, onCancel }: ContentEditorProps) {
  const [title, setTitle] = useState(content?.title ?? '');
  const [contentType, setContentType] = useState<ContentTypeValue>(
    content?.contentType ?? 'guideline'
  );
  const [category, setCategory] = useState(content?.category ?? '');
  const [tags, setTags] = useState<string[]>(content?.tags ?? []);
  const [description, setDescription] = useState(content?.description ?? '');
  const [body, setBody] = useState(content?.currentVersion?.body ?? '');
  const [changeDescription, setChangeDescription] = useState('');

  const setIsDirty = useContentStore((s) => s.setIsDirty);
  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent(content?.id ?? '');

  const isEditing = !!content;
  const isSaving = createMutation.isPending || updateMutation.isPending;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit Content' : 'New Content'}
        </h2>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Content'}
          </button>
        </div>
      </div>

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
        <label htmlFor="content-body" className="block text-sm font-medium text-gray-700">
          Content Body <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={20}
          className="mt-1 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Write your content in Markdown..."
        />
      </div>

      <div>
        <label
          htmlFor="change-description"
          className="block text-sm font-medium text-gray-700"
        >
          Change Description <span className="text-red-500">*</span>
        </label>
        <input
          id="change-description"
          type="text"
          value={changeDescription}
          onChange={(e) => setChangeDescription(e.target.value)}
          maxLength={2000}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Describe what changed and why"
        />
      </div>

      {(createMutation.error || updateMutation.error) && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {(createMutation.error || updateMutation.error)?.message || 'An error occurred'}
          </p>
        </div>
      )}
    </div>
  );
}

export default ContentEditor;
