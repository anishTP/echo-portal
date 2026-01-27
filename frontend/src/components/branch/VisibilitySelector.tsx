import { useState } from 'react';
import { Visibility, type VisibilityType } from '@echo-portal/shared';

interface VisibilitySelectorProps {
  value: VisibilityType;
  onChange: (visibility: VisibilityType) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface VisibilityOption {
  value: VisibilityType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const visibilityOptions: VisibilityOption[] = [
  {
    value: Visibility.PRIVATE,
    label: 'Private',
    description: 'Only you and assigned reviewers can see this branch',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    value: Visibility.TEAM,
    label: 'Team',
    description: 'All team members with reviewer or publisher roles can see this branch',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    value: Visibility.PUBLIC,
    label: 'Public',
    description: 'Anyone with access to the portal can see this branch',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: VisibilitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = visibilityOptions.find((opt) => opt.value === value);

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium
            ${disabled
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <span className="text-gray-500">{selectedOption?.icon}</span>
          <span>{selectedOption?.label}</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 w-72 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black/5">
              <div className="py-1">
                {visibilityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`
                      flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50
                      ${option.value === value ? 'bg-blue-50' : ''}
                    `}
                  >
                    <span className={option.value === value ? 'text-blue-600' : 'text-gray-400'}>
                      {option.icon}
                    </span>
                    <div>
                      <div className={`text-sm font-medium ${option.value === value ? 'text-blue-900' : 'text-gray-900'}`}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                    {option.value === value && (
                      <svg className="ml-auto h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Visibility</label>
      <div className="space-y-2">
        {visibilityOptions.map((option) => (
          <label
            key={option.value}
            className={`
              flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors
              ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}
              ${option.value === value
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200'
              }
            `}
          >
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={option.value === value ? 'text-blue-600' : 'text-gray-400'}>
              {option.icon}
            </span>
            <div className="flex-1">
              <div className={`text-sm font-medium ${option.value === value ? 'text-blue-900' : 'text-gray-900'}`}>
                {option.label}
              </div>
              <div className="mt-1 text-sm text-gray-500">{option.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default VisibilitySelector;
