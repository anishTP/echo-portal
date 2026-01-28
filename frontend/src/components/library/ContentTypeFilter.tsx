type ContentType = 'all' | 'guideline' | 'asset' | 'opinion';

interface ContentTypeFilterProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

const typeOptions: { value: ContentType; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
  { value: 'guideline', label: 'Guidelines', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
  { value: 'asset', label: 'Assets', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  { value: 'opinion', label: 'Opinions', color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
];

export function ContentTypeFilter({ value, onChange }: ContentTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {typeOptions.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isSelected
                ? option.color.replace('hover:', '')
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            } ${isSelected ? 'ring-2 ring-offset-1 ring-gray-300' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ContentTypeFilter;
