import { useState } from 'react';
import { Button, Text, Badge } from '@radix-ui/themes';
import {
  CommitIcon,
  CheckIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
  TrashIcon,
  DownloadIcon,
  MagicWandIcon,
  ResetIcon,
} from '@radix-ui/react-icons';
import { DeleteContentDialog } from '../content/DeleteContentDialog';
import type { SaveStatus } from '../../hooks/useAutoSave';
import styles from './EditModeHeader.module.css';

export interface EditModeHeaderProps {
  /** Branch name being edited */
  branchName: string;
  /** Content title being edited */
  contentTitle: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Current save status */
  saveStatus?: SaveStatus;
  /** Callback to save and exit */
  onDone: () => void;
  /** Callback to exit without saving */
  onCancel: () => void;
  /** Callback to save draft */
  onSaveDraft?: () => void;
  /** Callback to delete content */
  onDelete?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Delete error message */
  deleteError?: string | null;
  /** AI panel toggle callback */
  onToggleAI?: () => void;
  /** Whether AI panel is currently open */
  aiPanelOpen?: boolean;
  /** Undo callback */
  onUndo?: () => void;
  /** Redo callback */
  onRedo?: () => void;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
}

/**
 * Header banner displayed when in edit mode on the Library page.
 * Shows branch info and quick actions.
 */
export function EditModeHeader({
  branchName,
  contentTitle,
  hasUnsavedChanges,
  saveStatus,
  onDone,
  onCancel,
  onSaveDraft,
  onDelete,
  isSaving = false,
  isDeleting = false,
  deleteError = null,
  onToggleAI,
  aiPanelOpen = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: EditModeHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusBadge = () => {
    if (isSaving || saveStatus === 'saving') {
      return <Badge color="amber" variant="soft" size="1">Saving...</Badge>;
    }
    if (hasUnsavedChanges || saveStatus === 'dirty') {
      return (
        <Text size="1" color="amber" className={styles.unsavedIndicator}>
          <ExclamationTriangleIcon width={12} height={12} />
          Unsaved
        </Text>
      );
    }
    if (saveStatus === 'saved') {
      return <Badge color="green" variant="soft" size="1">Saved</Badge>;
    }
    return null;
  };

  return (
    <div className={styles.header}>
      <div className={styles.content}>
        <div className={styles.info}>
          <div className={styles.branchBadge}>
            <CommitIcon width={14} height={14} />
            <Text size="2" weight="medium">
              {branchName}
            </Text>
          </div>
          <Text size="2" color="gray" className={styles.editingText}>
            Editing: {contentTitle}
          </Text>
          {getStatusBadge()}
        </div>

        <div className={styles.actions}>
          {onUndo && (
            <Button
              variant="soft"
              size="2"
              onClick={onUndo}
              disabled={isSaving || !canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <ResetIcon />
              Undo
            </Button>
          )}

          {onRedo && (
            <Button
              variant="soft"
              size="2"
              onClick={onRedo}
              disabled={isSaving || !canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <ResetIcon style={{ transform: 'scaleX(-1)' }} />
              Redo
            </Button>
          )}

          {onToggleAI && (
            <Button
              variant={aiPanelOpen ? 'solid' : 'soft'}
              size="2"
              onClick={onToggleAI}
              disabled={isSaving}
              title="AI Assistant"
              aria-label="Toggle AI Assistant"
            >
              <MagicWandIcon />
              AI
            </Button>
          )}

          {onDelete && (
            <Button
              variant="soft"
              color="red"
              size="2"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSaving || isDeleting}
            >
              <TrashIcon />
              Delete
            </Button>
          )}

          {onSaveDraft && (
            <Button
              variant="soft"
              size="2"
              onClick={onSaveDraft}
              disabled={isSaving || !hasUnsavedChanges}
            >
              <DownloadIcon />
              Save Draft
            </Button>
          )}

          <Button
            variant="soft"
            size="2"
            onClick={onCancel}
            disabled={isSaving}
          >
            <Cross2Icon />
            Cancel
          </Button>

          <Button
            variant="solid"
            size="2"
            color="green"
            onClick={onDone}
            disabled={isSaving}
          >
            <CheckIcon />
            Done
          </Button>
        </div>
      </div>

      {onDelete && (
        <DeleteContentDialog
          contentTitle={contentTitle}
          isOpen={showDeleteDialog}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={() => {
            onDelete();
            setShowDeleteDialog(false);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}

export default EditModeHeader;
