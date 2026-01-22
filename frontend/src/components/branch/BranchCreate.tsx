import { useState, type FormEvent } from 'react';
import { useCreateBranch } from '../../hooks/useBranch';
import { useBranchStore } from '../../stores/branchStore';
import type { BranchCreateInput, VisibilityType } from '@echo-portal/shared';

interface BranchCreateProps {
  onSuccess?: (branchId: string) => void;
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
      onSuccess?.(branch.id);
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
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Branch Name *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter branch name"
        />
      </div>

      <div>
        <label htmlFor="baseRef" className="block text-sm font-medium text-gray-700">
          Base Branch *
        </label>
        <select
          id="baseRef"
          value={formData.baseRef}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, baseRef: e.target.value as 'main' | 'dev' }))
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="main">main (Production)</option>
          <option value="dev">dev (Development)</option>
        </select>
        <p className="mt-1 text-sm text-gray-500">
          Your branch will start from the current state of this branch.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Describe the purpose of this branch..."
        />
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
          Visibility
        </label>
        <select
          id="visibility"
          value={formData.visibility}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              visibility: e.target.value as VisibilityType,
            }))
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="private">Private - Only you can see this branch</option>
          <option value="team">Team - Team members can see this branch</option>
          <option value="public">Public - Anyone can see this branch</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Labels</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLabel();
              }
            }}
            className="block flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Add a label"
          />
          <button
            type="button"
            onClick={handleAddLabel}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Add
          </button>
        </div>
        {formData.labels && formData.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {formData.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-800"
              >
                {label}
                <button
                  type="button"
                  onClick={() => handleRemoveLabel(label)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isCreating || !formData.name}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Branch'}
        </button>
      </div>
    </form>
  );
}

export default BranchCreate;
