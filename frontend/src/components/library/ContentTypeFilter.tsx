import { Button } from '@radix-ui/themes';

type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

interface ContentTypeFilterProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

const typeOptions: { value: ContentType; label: string; color: 'gray' | 'green' | 'purple' | 'orange' }[] = [
  { value: 'all', label: 'All', color: 'gray' },
  { value: 'guideline', label: 'Guidelines', color: 'green' },
  { value: 'asset', label: 'Assets', color: 'purple' },
  { value: 'opinion', label: 'Opinions', color: 'orange' },
];

export function ContentTypeFilter({ value, onChange }: ContentTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {typeOptions.map((option) => {
        const isSelected = value === option.value;
        return (
          <Button
            key={option.value}
            variant={isSelected ? 'solid' : 'soft'}
            size="2"
            color={option.color}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export default ContentTypeFilter;
