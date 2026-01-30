import { Dialog, Button, Text, Callout, Flex } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface DeleteContentDialogProps {
  contentTitle: string;
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteContentDialog({
  contentTitle,
  isOpen,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteContentDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Delete Content</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          You are about to delete <Text weight="bold">{contentTitle}</Text>.
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          <Callout.Root color="red">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>
              This will remove the content from this branch. The content can be
              recovered by an administrator if needed.
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
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button color="red" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default DeleteContentDialog;
