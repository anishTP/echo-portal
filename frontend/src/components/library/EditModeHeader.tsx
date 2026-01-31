import { Button, Text } from '@radix-ui/themes';
import {
  CommitIcon,
  CheckIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import styles from './EditModeHeader.module.css';

export interface EditModeHeaderProps {
  /** Branch name being edited */
  branchName: string;
  /** Content title being edited */
  contentTitle: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Callback to save and exit */
  onDone: () => void;
  /** Callback to exit without saving */
  onCancel: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
}

/**
 * Header banner displayed when in edit mode on the Library page.
 * Shows branch info and quick actions.
 */
export function EditModeHeader({
  branchName,
  contentTitle,
  hasUnsavedChanges,
  onDone,
  onCancel,
  isSaving = false,
}: EditModeHeaderProps) {
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
          <Text size="2" color="gray">
            Editing: {contentTitle}
          </Text>
        </div>

        <div className={styles.actions}>
          {hasUnsavedChanges && (
            <Text size="1" color="amber" className={styles.unsavedIndicator}>
              <ExclamationTriangleIcon width={12} height={12} />
              Unsaved changes
            </Text>
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
    </div>
  );
}

export default EditModeHeader;
