import { memo } from 'react';
import { Card, Text } from '@radix-ui/themes';
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
      <Text as="label" size="2" weight="medium">Content Type</Text>
      <div className="grid grid-cols-3 gap-3">
        {contentTypes.map((type) => (
          <Card
            key={type.value}
            asChild
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              borderWidth: '2px',
              borderColor: value === type.value ? 'var(--accent-9)' : 'var(--gray-6)',
              backgroundColor: value === type.value ? 'var(--accent-3)' : undefined,
            }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(type.value)}
              className="text-left w-full"
            >
              <Text as="div" size="2" weight="medium">{type.label}</Text>
              <Text as="div" size="1" color="gray" className="mt-1">{type.description}</Text>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
});

export default ContentTypeSelector;
