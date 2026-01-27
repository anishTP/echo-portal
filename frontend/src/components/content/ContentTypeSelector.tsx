import { memo } from 'react';
import type { ContentTypeValue } from '@echo-portal/shared';

interface ContentTypeSelectorProps {
  value: ContentTypeValue;
  onChange: (type: ContentTypeValue) => void;
  disabled?: boolean;
}

const contentTypes: { value: ContentTypeValue; label: string; description: string }[] = [
  {
    value: 'guideline',
    label: 'Guideline',
    description: 'Design guidelines, standards, and best practices',
  },
  {
    value: 'asset',
    label: 'Asset',
    description: 'Design tokens, icons, components, and other reusable assets',
  },
  {
    value: 'opinion',
    label: 'Opinion',
    description: 'Design rationale, decisions, and commentary',
  },
];

export const ContentTypeSelector = memo(function ContentTypeSelector({
  value,
  onChange,
  disabled = false,
}: ContentTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Content Type</label>
      <div className="grid grid-cols-3 gap-3">
        {contentTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type.value)}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${
              value === type.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <div className="text-sm font-medium text-gray-900">{type.label}</div>
            <div className="mt-1 text-xs text-gray-500">{type.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
});

export default ContentTypeSelector;
