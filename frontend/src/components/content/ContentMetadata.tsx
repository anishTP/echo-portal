import { memo, useState, useCallback } from 'react';
import { TextField, TextArea, Button, Badge } from '@radix-ui/themes';

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
        <label htmlFor="content-title" className="block text-sm font-medium mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <TextField.Root
          id="content-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          maxLength={500}
          placeholder="Enter content title"
        />
      </div>

      <div>
        <label htmlFor="content-category" className="block text-sm font-medium mb-1">
          Category
        </label>
        <TextField.Root
          id="content-category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder="e.g. Typography, Color, Layout"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Tags ({tags.length}/20)
        </label>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} color="blue" size="1">
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:opacity-70"
                >
                  x
                </button>
              )}
            </Badge>
          ))}
        </div>
        {!disabled && (
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <TextField.Root
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                maxLength={100}
                placeholder="Add a tag and press Enter"
              />
            </div>
            <Button
              type="button"
              variant="soft"
              size="2"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="content-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <TextArea
          id="content-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          maxLength={5000}
          rows={3}
          placeholder="Brief description of this content"
        />
      </div>
    </div>
  );
});

export default ContentMetadata;
