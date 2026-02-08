import { useState, useCallback } from 'react';
import { Dialog, Button, TextField, Text, Flex, Callout } from '@radix-ui/themes';
import { ResetIcon } from '@radix-ui/react-icons';
import type { ContentVersionSummary } from '@echo-portal/shared';

export interface RevertDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Version to revert to */
  version: ContentVersionSummary | null;
  /** Called when dialog is closed or cancelled */
  onClose: () => void;
  /** Called when user confirms revert with description */
  onRevert: (description: string) => Promise<void>;
  /** Whether revert is in progress */
  isReverting: boolean;
  /** Optional error message */
  error?: string | null;
}

/**
 * Dialog for confirming revert to a previous version.
 * Implements US4 - Revert to Version functionality.
 */
export function RevertDialog({
  isOpen,
  version,
  onClose,
  onRevert,
  isReverting,
  error,
}: RevertDialogProps) {
  const defaultDescription = version
    ? `Reverted to version from ${new Date(version.versionTimestamp).toLocaleString()}`
    : '';
  const [description, setDescription] = useState(defaultDescription);

  // Reset description when dialog opens with new version
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    } else if (version) {
      setDescription(`Reverted to version from ${new Date(version.versionTimestamp).toLocaleString()}`);
    }
  }, [onClose, version]);

  const handleRevert = useCallback(async () => {
    if (!description.trim() || !version) return;
    await onRevert(description.trim());
  }, [description, version, onRevert]);

  const canRevert = version && description.trim().length > 0 && !isReverting;

  if (!version) return null;

  const formattedDate = new Date(version.versionTimestamp).toLocaleString();
  const isAIVersion = (version as any).authorType === 'system';

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          <Flex align="center" gap="2">
            <ResetIcon />
            {isAIVersion ? 'Revert AI-Generated Content' : 'Revert to Previous Version'}
          </Flex>
        </Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {isAIVersion
            ? 'This will revert the AI-generated content to the pre-AI state.'
            : 'This will create a new version with the content from the selected version.'}
        </Dialog.Description>

        {/* AI-specific warning (T046) */}
        {isAIVersion && (
          <Callout.Root color="amber" mb="4">
            <Callout.Text>
              <Text weight="medium">AI Content Revert</Text>
              <br />
              <Text size="2">
                Human edits made after this AI version will remain in version history but the
                current content will revert to the pre-AI state.
              </Text>
            </Callout.Text>
          </Callout.Root>
        )}

        <Callout.Root color="blue" mb="4">
          <Callout.Text>
            <Text weight="medium">Reverting to:</Text>
            <br />
            <Text size="2">{formattedDate}</Text>
            <br />
            <Text size="2" color="gray">
              By {version.author.displayName} &middot; {version.changeDescription}
            </Text>
          </Callout.Text>
        </Callout.Root>

        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Change Description <span style={{ color: 'var(--red-9)' }}>*</span>
            </Text>
            <TextField.Root
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe why you are reverting"
              maxLength={500}
              disabled={isReverting}
              autoFocus
            />
            <Text size="1" color="gray" mt="1">
              {description.length}/500 characters
            </Text>
          </label>
        </Flex>

        {error && (
          <Callout.Root color="red" mt="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isReverting}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button onClick={handleRevert} disabled={!canRevert} color="amber">
            {isReverting ? 'Reverting...' : 'Revert'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default RevertDialog;
