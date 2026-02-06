import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from './InlineMetadataHeader.module.css';

export interface InlineMetadataHeaderProps {
  /** Current category value */
  category: string;
  /** Current title value */
  title: string;
  /** Current description value */
  description: string;
  /** Callback when category changes */
  onCategoryChange: (category: string) => void;
  /** Callback when title changes */
  onTitleChange: (title: string) => void;
  /** Callback when description changes */
  onDescriptionChange: (description: string) => void;
  /** CSS class name */
  className?: string;
}

/**
 * Inline editable metadata header matching ContentRenderer layout.
 * Fields look like static text until hovered/focused.
 */
function InlineMetadataHeaderComponent({
  category,
  title,
  description,
  onCategoryChange,
  onTitleChange,
  onDescriptionChange,
  className = '',
}: InlineMetadataHeaderProps) {
  // Local state for controlled inputs
  const [localCategory, setLocalCategory] = useState(category);
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description);

  // Refs for auto-resizing textarea
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state with props when they change externally
  useEffect(() => {
    setLocalCategory(category);
  }, [category]);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = descriptionRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [localDescription]);

  const handleCategoryBlur = useCallback(() => {
    if (localCategory !== category) {
      onCategoryChange(localCategory);
    }
  }, [localCategory, category, onCategoryChange]);

  const handleTitleBlur = useCallback(() => {
    if (localTitle !== title) {
      onTitleChange(localTitle);
    }
  }, [localTitle, title, onTitleChange]);

  const handleDescriptionBlur = useCallback(() => {
    if (localDescription !== description) {
      onDescriptionChange(localDescription);
    }
  }, [localDescription, description, onDescriptionChange]);

  // Stop keyboard event propagation to prevent Vimium and other extensions from capturing keystrokes
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <header className={`${styles.header} ${className}`} data-vimium-ignore>
      {/* Category breadcrumb */}
      <div className={styles.breadcrumb}>
        <input
          type="text"
          value={localCategory}
          onChange={(e) => setLocalCategory(e.target.value)}
          onBlur={handleCategoryBlur}
          onKeyDown={stopKeyPropagation}
          onKeyUp={stopKeyPropagation}
          placeholder="Category"
          className={styles.categoryInput}
          aria-label="Category"
        />
      </div>

      {/* Title */}
      <input
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={stopKeyPropagation}
        onKeyUp={stopKeyPropagation}
        placeholder="Untitled"
        className={styles.titleInput}
        aria-label="Title"
      />

      {/* Description */}
      <textarea
        ref={descriptionRef}
        value={localDescription}
        onChange={(e) => setLocalDescription(e.target.value)}
        onBlur={handleDescriptionBlur}
        onKeyDown={stopKeyPropagation}
        onKeyUp={stopKeyPropagation}
        placeholder="Add a description..."
        className={styles.descriptionInput}
        rows={1}
        aria-label="Description"
      />
    </header>
  );
}

// Memoize to prevent re-renders
export const InlineMetadataHeader = React.memo(InlineMetadataHeaderComponent);

export default InlineMetadataHeader;
