import { useState } from 'react';
import { Dialog, Button, Text, Flex, TextField, Select } from '@radix-ui/themes';

export interface CreateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  onConfirm: (title: string, contentType: 'guideline' | 'asset' | 'opinion') => void;
  isLoading?: boolean;
  error?: string;
}

export function CreateContentDialog({
  open,
  onOpenChange,
  category,
  onConfirm,
  isLoading = false,
  error,
}: CreateContentDialogProps) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'guideline' | 'asset' | 'opinion'>('guideline');

  const handleConfirm = () => {
    if (!title.trim()) return;
    onConfirm(title.trim(), contentType);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle('');
      setContentType('guideline');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>New Content</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          Create new content in <Text weight="medium">{category}</Text>
        </Dialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <label>
            <Text size="2" weight="medium" mb="1" as="p">Title</Text>
            <TextField.Root
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) handleConfirm();
              }}
            />
          </label>

          <label>
            <Text size="2" weight="medium" mb="1" as="p">Type</Text>
            <Select.Root value={contentType} onValueChange={(v) => setContentType(v as 'guideline' | 'asset' | 'opinion')}>
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="guideline">Guideline</Select.Item>
                <Select.Item value="asset">Asset</Select.Item>
                <Select.Item value="opinion">Opinion</Select.Item>
              </Select.Content>
            </Select.Root>
          </label>

          {error && (
            <Text size="2" color="red">{error}</Text>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isLoading}>Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={handleConfirm}
            disabled={!title.trim() || isLoading}
            loading={isLoading}
          >
            Create
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
