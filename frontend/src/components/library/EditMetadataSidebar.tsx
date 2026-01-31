import React, { useState, useCallback, useEffect } from 'react';
import { Button, TextField, TextArea, Badge, Text } from '@radix-ui/themes';
import {
  CheckIcon,
  Cross2Icon,
  Pencil1Icon,
  TrashIcon,
  PlusIcon,
  CommitIcon,
} from '@radix-ui/react-icons';
import type { SaveStatus } from '../../hooks/useAutoSave';
import type { SyncStatus } from '../../hooks/useDraftSync';
import styles from './EditMetadataSidebar.module.css';

export interface EditMetadataSidebarProps {
  /** Current title */
  title: string;
  /** Current category */
  category?: string;
  /** Current tags */
  tags: string[];
  /** Current description */
  description?: string;
  /** Branch name being edited */
  branchName: string;
  /** Save status for display */
  saveStatus: SaveStatus;
  /** Sync status for display */
  syncStatus: SyncStatus;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Callback when title changes */
  onTitleChange: (title: string) => void;
  /** Callback when category changes */
  onCategoryChange: (category: string) => void;
  /** Callback when tags change */
  onTagsChange: (tags: string[]) => void;
  /** Callback when description changes */
  onDescriptionChange: (description: string) => void;
  /** Callback to save draft manually */
  onSaveDraft: () => void;
  /** Callback to exit edit mode */
  onDoneEditing: () => void;
  /** Callback to discard changes */
  onDiscard: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
}

/**
 * Sidebar for editing content metadata in Library edit mode.
 * Replaces ContentMetadataSidebar when in edit mode.
 */
function EditMetadataSidebarComponent({
  title,
  category = '',
  tags,
  description = '',
  branchName,
  saveStatus,
  syncStatus,
  isDirty,
  onTitleChange,
  onCategoryChange,
  onTagsChange,
  onDescriptionChange,
  onSaveDraft,
  onDoneEditing,
  onDiscard,
  isSaving = false,
}: EditMetadataSidebarProps) {
  const [newTag, setNewTag] = useState('');
  const [localTitle, setLocalTitle] = useState(title);
  const [localCategory, setLocalCategory] = useState(category);
  const [localDescription, setLocalDescription] = useState(description);

  // Sync local state with props when they change externally
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalCategory(category);
  }, [category]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  const handleTitleBlur = useCallback(() => {
    if (localTitle !== title) {
      onTitleChange(localTitle);
    }
  }, [localTitle, title, onTitleChange]);

  const handleCategoryBlur = useCallback(() => {
    if (localCategory !== category) {
      onCategoryChange(localCategory);
    }
  }, [localCategory, category, onCategoryChange]);

  const handleDescriptionBlur = useCallback(() => {
    if (localDescription !== description) {
      onDescriptionChange(localDescription);
    }
  }, [localDescription, description, onDescriptionChange]);

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setNewTag('');
    }
  }, [newTag, tags, onTagsChange]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((t) => t !== tagToRemove));
    },
    [tags, onTagsChange]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop propagation to prevent Vimium interference
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  // Stop keyboard event propagation to prevent Vimium and other extensions from capturing keystrokes
  const stopKeyPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const getStatusColor = () => {
    if (syncStatus === 'synced') return 'green';
    if (syncStatus === 'syncing') return 'amber';
    if (syncStatus === 'error' || syncStatus === 'conflict') return 'red';
    if (saveStatus === 'saved') return 'green';
    if (saveStatus === 'saving') return 'amber';
    if (saveStatus === 'dirty') return 'amber';
    return 'gray';
  };

  const getStatusText = () => {
    if (syncStatus === 'synced') return 'Synced';
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync failed';
    if (syncStatus === 'conflict') return 'Conflict';
    if (saveStatus === 'saved') return 'Saved locally';
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'dirty') return 'Unsaved changes';
    return 'Ready';
  };

  return (
    <div className={styles.sidebar} data-vimium-ignore>
      {/* Branch indicator */}
      <div className={styles.section}>
        <div className={styles.branchIndicator}>
          <CommitIcon width={14} height={14} />
          <Text size="2" weight="medium">
            {branchName}
          </Text>
        </div>
        <Badge color={getStatusColor()} variant="soft" size="1">
          {getStatusText()}
        </Badge>
      </div>

      {/* Title */}
      <div className={styles.section}>
        <label className={styles.label}>Title</label>
        <TextField.Root
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={stopKeyPropagation}
          onKeyUp={stopKeyPropagation}
          placeholder="Content title"
        />
      </div>

      {/* Category */}
      <div className={styles.section}>
        <label className={styles.label}>Category</label>
        <TextField.Root
          value={localCategory}
          onChange={(e) => setLocalCategory(e.target.value)}
          onBlur={handleCategoryBlur}
          onKeyDown={stopKeyPropagation}
          onKeyUp={stopKeyPropagation}
          placeholder="e.g., Getting Started"
        />
      </div>

      {/* Tags */}
      <div className={styles.section}>
        <label className={styles.label}>Tags</label>
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <Badge key={tag} variant="soft" size="1" className={styles.tag}>
              {tag}
              <button
                className={styles.tagRemove}
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                <Cross2Icon width={10} height={10} />
              </button>
            </Badge>
          ))}
        </div>
        <div className={styles.tagInput}>
          <TextField.Root
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onKeyUp={stopKeyPropagation}
            placeholder="Add tag..."
            size="1"
          />
          <Button variant="soft" size="1" onClick={handleAddTag} disabled={!newTag.trim()}>
            <PlusIcon width={12} height={12} />
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className={styles.section}>
        <label className={styles.label}>Description</label>
        <TextArea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          onKeyDown={stopKeyPropagation}
          onKeyUp={stopKeyPropagation}
          placeholder="Brief description of this content..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="solid"
          color="green"
          onClick={onDoneEditing}
          disabled={isSaving}
          className={styles.actionButton}
        >
          <CheckIcon />
          Done Editing
        </Button>

        <Button
          variant="soft"
          onClick={onSaveDraft}
          disabled={isSaving || !isDirty}
          className={styles.actionButton}
        >
          <Pencil1Icon />
          Save Draft
        </Button>

        <Button
          variant="soft"
          color="red"
          onClick={onDiscard}
          disabled={isSaving}
          className={styles.actionButton}
        >
          <TrashIcon />
          Discard
        </Button>
      </div>
    </div>
  );
}

// Memoize to prevent re-renders from syncStatus changes causing focus loss
export const EditMetadataSidebar = React.memo(EditMetadataSidebarComponent);

export default EditMetadataSidebar;
