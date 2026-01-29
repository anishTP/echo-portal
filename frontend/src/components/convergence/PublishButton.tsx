import { useState } from 'react';
import { Dialog, Button, Text, Callout, Flex } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface PublishButtonProps {
  branchId: string;
  branchName: string;
  canPublish: boolean;
  isApproved: boolean;
  onPublish: () => Promise<void>;
}

export function PublishButton({
  branchId,
  branchName,
  canPublish,
  isApproved,
  onPublish,
}: PublishButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      await onPublish();
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const getButtonState = () => {
    if (!isApproved) {
      return {
        disabled: true,
        label: 'Needs Approval',
        className: 'bg-gray-300 text-gray-500 cursor-not-allowed',
      };
    }

    if (!canPublish) {
      return {
        disabled: true,
        label: 'Cannot Publish',
        className: 'bg-gray-300 text-gray-500 cursor-not-allowed',
      };
    }

    return {
      disabled: false,
      label: 'Publish to Main',
      className: 'bg-purple-600 text-white hover:bg-purple-700',
    };
  };

  const buttonState = getButtonState();

  return (
    <Dialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
      <Dialog.Trigger>
        <Button
          color={buttonState.disabled ? 'gray' : 'purple'}
          disabled={buttonState.disabled}
        >
          {buttonState.label}
        </Button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Publish Branch</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          You are about to publish <Text weight="bold">{branchName}</Text> to main.
          This action will merge all changes and make them live.
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          <Callout.Root color="yellow">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>
              This action cannot be undone. Make sure all changes have
              been reviewed and approved.
            </Callout.Text>
          </Callout.Root>

          {error && (
            <Callout.Root color="red">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}
        </Flex>

        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="outline" disabled={isPublishing}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button color="purple" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? 'Publishing...' : 'Confirm Publish'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default PublishButton;
