import { useState, type FormEvent } from 'react';
import { Button, TextField, TextArea, Select, Badge, IconButton } from '@radix-ui/themes';
import { Cross1Icon } from '@radix-ui/react-icons';
import { useCreateBranch } from '../../hooks/useBranch';
import { useBranchStore } from '../../stores/branchStore';
import type { BranchCreateInput, VisibilityType } from '@echo-portal/shared';
import type { BranchResponse } from '../../services/branchService';

interface BranchCreateProps {
  onSuccess?: (branchId: string, branch: BranchResponse) => void;
  onCancel?: () => void;
}

export function BranchCreate({ onSuccess, onCancel }: BranchCreateProps) {
  const createBranch = useCreateBranch();
  const isCreating = useBranchStore((s) => s.isCreating);

  const [formData, setFormData] = useState<BranchCreateInput>({
    name: '',
    baseRef: 'main',
    description: '',
    visibility: 'private',
    labels: [],
  });

  const [labelInput, setLabelInput] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const branch = await createBranch.mutateAsync(formData);
      onSuccess?.(branch.id, branch);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleAddLabel = () => {
    const label = labelInput.trim();
    if (label && !formData.labels?.includes(label)) {
      setFormData((prev) => ({
        ...prev,
        labels: [...(prev.labels || []), label],
      }));
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels?.filter((l) => l !== label) || [],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Branch Name *
        </label>
        <TextField.Root
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Enter branch name"
        />
      </div>

      <div>
        <label htmlFor="baseRef" className="block text-sm font-medium mb-1">
          Base Branch *
        </label>
        <Select.Root
          value={formData.baseRef}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, baseRef: value as 'main' | 'dev' }))
          }
        >
          <Select.Trigger placeholder="Select base branch" style={{ width: '100%' }} />
          <Select.Content>
            <Select.Item value="main">main (Production)</Select.Item>
          </Select.Content>
        </Select.Root>
        <p className="mt-1 text-sm text-[var(--gray-11)]">
          Your branch will start from the current state of main.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <TextArea
          id="description"
          rows={3}
          value={formData.description || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the purpose of this branch..."
        />
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium mb-1">
          Visibility
        </label>
        <Select.Root
          value={formData.visibility}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              visibility: value as VisibilityType,
            }))
          }
        >
          <Select.Trigger placeholder="Select visibility" style={{ width: '100%' }} />
          <Select.Content>
            <Select.Item value="private">Private - Only you can see this branch</Select.Item>
            <Select.Item value="team">Team - Team members can see this branch</Select.Item>
            <Select.Item value="public">Public - Anyone can see this branch</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Labels</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <TextField.Root
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLabel();
                }
              }}
              placeholder="Add a label"
            />
          </div>
          <Button type="button" variant="soft" onClick={handleAddLabel}>
            Add
          </Button>
        </div>
        {formData.labels && formData.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {formData.labels.map((label) => (
              <Badge key={label} color="blue">
                {label}
                <IconButton
                  variant="ghost"
                  size="1"
                  onClick={() => handleRemoveLabel(label)}
                  style={{ marginLeft: '2px', width: '14px', height: '14px' }}
                >
                  <Cross1Icon width={10} height={10} />
                </IconButton>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isCreating || !formData.name}>
          {isCreating ? 'Creating...' : 'Create Branch'}
        </Button>
      </div>
    </form>
  );
}

export default BranchCreate;
