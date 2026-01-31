import { useState, useEffect } from 'react';
import { Dialog, Button, TextField, Text, Flex, Spinner } from '@radix-ui/themes';
import { suggestBranchName, suggestBranchDisplayName, isValidBranchSlug } from '../../utils/branch-utils';

export interface BranchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentTitle: string;
  contentSlug: string;
  onConfirm: (branchName: string, branchSlug: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Dialog for creating a new branch to edit published content.
 * Pre-fills branch name based on content being edited.
 */
export function BranchCreateDialog({
  open,
  onOpenChange,
  contentTitle,
  contentSlug,
  onConfirm,
  isLoading = false,
  error = null,
}: BranchCreateDialogProps) {
  const [branchName, setBranchName] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);

  // Pre-fill when dialog opens
  useEffect(() => {
    if (open) {
      setBranchName(suggestBranchDisplayName(contentTitle));
      setBranchSlug(suggestBranchName(contentSlug));
      setSlugError(null);
    }
  }, [open, contentTitle, contentSlug]);

  const handleSlugChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setBranchSlug(normalized);

    if (normalized && !isValidBranchSlug(normalized)) {
      setSlugError('Slug must contain only lowercase letters, numbers, and hyphens');
    } else {
      setSlugError(null);
    }
  };

  const handleConfirm = () => {
    if (!branchName.trim() || !branchSlug.trim() || slugError) {
      return;
    }
    onConfirm(branchName.trim(), branchSlug.trim());
  };

  const canSubmit = branchName.trim() && branchSlug.trim() && !slugError && !isLoading;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Create Edit Branch</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Create a new branch to edit "{contentTitle}". Your changes will be saved to this branch
          until you submit them for review.
        </Dialog.Description>

        <Flex direction="column" gap="4">
          <label>
            <Text as="div" size="2" weight="medium" mb="1">
              Branch Name
            </Text>
            <TextField.Root
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g., Edit: Getting Started"
              disabled={isLoading}
            />
          </label>

          <label>
            <Text as="div" size="2" weight="medium" mb="1">
              Branch Slug
            </Text>
            <TextField.Root
              value={branchSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g., edit-getting-started-abc123"
              disabled={isLoading}
            />
            {slugError && (
              <Text size="1" color="red" mt="1">
                {slugError}
              </Text>
            )}
            <Text size="1" color="gray" mt="1">
              URL-safe identifier for this branch
            </Text>
          </label>

          {error && (
            <Text size="2" color="red">
              {error}
            </Text>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isLoading}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isLoading ? (
              <>
                <Spinner size="1" />
                Creating...
              </>
            ) : (
              'Create Branch'
            )}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default BranchCreateDialog;
