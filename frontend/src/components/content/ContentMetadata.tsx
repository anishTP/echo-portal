import { memo, useState, useCallback } from 'react';

interface ContentMetadataProps {
  title: string;
  category: string;
  tags: string[];
  description: string;
  onTitleChange: (title: string) => void;
  onCategoryChange: (category: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDescriptionChange: (description: string) => void;
  disabled?: boolean;
}

export const ContentMetadata = memo(function ContentMetadata({
  title,
  category,
  tags,
  description,
  onTitleChange,
  onCategoryChange,
  onTagsChange,
  onDescriptionChange,
  disabled = false,
}: ContentMetadataProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      onTagsChange([...tags, trimmed]);
      setTagInput('');
    }
  }, [tagInput, tags, onTagsChange]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onTagsChange(tags.filter((t) => t !== tag));
    },
    [tags, onTagsChange]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="content-title" className="block text-sm font-medium text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="content-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          maxLength={500}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 sm:text-sm"
          placeholder="Enter content title"
        />
      </div>

      <div>
        <label htmlFor="content-category" className="block text-sm font-medium text-gray-700">
          Category
        </label>
        <input
          id="content-category"
          type="text"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 sm:text-sm"
          placeholder="e.g. Typography, Color, Layout"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tags ({tags.length}/20)
        </label>
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-0.5 text-blue-600 hover:text-blue-900"
                >
                  x
                </button>
              )}
            </span>
          ))}
        </div>
        {!disabled && (
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              maxLength={100}
              className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Add a tag and press Enter"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="content-description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="content-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          maxLength={5000}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 sm:text-sm"
          placeholder="Brief description of this content"
        />
      </div>
    </div>
  );
});

export default ContentMetadata;
