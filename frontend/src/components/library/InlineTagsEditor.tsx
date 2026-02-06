import React, { useState, useCallback } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import styles from './InlineTagsEditor.module.css';

export interface InlineTagsEditorProps {
  /** Current tags */
  tags: string[];
  /** Callback when tags change */
  onTagsChange: (tags: string[]) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Inline tags editor matching ContentRenderer footer style.
 * Displays tags as badges with remove buttons, plus an add input.
 */
function InlineTagsEditorComponent({
  tags,
  onTagsChange,
  className = '',
}: InlineTagsEditorProps) {
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setNewTag('');
    }
    setIsAdding(false);
  }, [newTag, tags, onTagsChange]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((t) => t !== tagToRemove));
    },
    [tags, onTagsChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Escape') {
        setNewTag('');
        setIsAdding(false);
      }
    },
    [handleAddTag]
  );

  // Stop keyboard event propagation to prevent Vimium and other extensions from capturing keystrokes
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <footer className={`${styles.footer} ${className}`} data-vimium-ignore>
      <div className={styles.tagsContainer}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button
              className={styles.tagRemove}
              onClick={() => handleRemoveTag(tag)}
              aria-label={`Remove ${tag} tag`}
            >
              <Cross2Icon width={10} height={10} />
            </button>
          </span>
        ))}

        {isAdding ? (
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={handleAddTag}
            onKeyDown={handleKeyDown}
            onKeyUp={stopKeyPropagation}
            placeholder="Tag name..."
            className={styles.tagInput}
            autoFocus
            aria-label="New tag"
          />
        ) : (
          <button
            className={styles.addButton}
            onClick={() => setIsAdding(true)}
            aria-label="Add tag"
          >
            <PlusIcon width={12} height={12} />
            Add tag
          </button>
        )}
      </div>
    </footer>
  );
}

// Memoize to prevent re-renders
export const InlineTagsEditor = React.memo(InlineTagsEditorComponent);

export default InlineTagsEditor;
