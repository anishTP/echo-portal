import { useState, useCallback } from 'react';
import { Dialog, Button, TextField, Text, Flex, Callout } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';

export interface SaveDraftDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog is closed or cancelled */
  onClose: () => void;
  /** Called when user confirms save with description */
  onSave: (changeDescription: string) => Promise<void>;
  /** Whether there are changes to save */
  hasChanges: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Optional error message */
  error?: string | null;
  /** Suggested description based on changes */
  suggestedDescription?: string;
}

/**
 * Dialog for manually saving a draft with a change description.
 * Implements US4 - Manual Draft Save requirements.
 */
export function SaveDraftDialog({
  isOpen,
  onClose,
  onSave,
  hasChanges,
  isSaving,
  error,
  suggestedDescription = '',
}: SaveDraftDialogProps) {
  const [description, setDescription] = useState(suggestedDescription);

  const handleSave = useCallback(async () => {
    if (!description.trim() || !hasChanges) return;
    await onSave(description.trim());
    setDescription('');
  }, [description, hasChanges, onSave]);

  const handleClose = useCallback(() => {
    setDescription('');
    onClose();
  }, [onClose]);

  const canSave = hasChanges && description.trim().length > 0 && !isSaving;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Save Draft</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Create a versioned snapshot of your current changes.
        </Dialog.Description>

        {!hasChanges ? (
          <Callout.Root color="blue" mb="4">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>
              There are no changes to save. Make some edits first.
            </Callout.Text>
          </Callout.Root>
        ) : (
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="medium">
                Change Description <span style={{ color: 'var(--red-9)' }}>*</span>
              </Text>
              <TextField.Root
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what changed and why"
                maxLength={500}
                disabled={isSaving}
                autoFocus
              />
              <Text size="1" color="gray" mt="1">
                {description.length}/500 characters
              </Text>
            </label>
          </Flex>
        )}

        {error && (
          <Callout.Root color="red" mt="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isSaving}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default SaveDraftDialog;
