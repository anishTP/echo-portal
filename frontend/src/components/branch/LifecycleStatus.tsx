import type { BranchStateType } from '@echo-portal/shared';

interface LifecycleStatusProps {
  state: BranchStateType;
  size?: 'sm' | 'md' | 'lg';
}

const stateConfig: Record<
  BranchStateType,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  review: {
    label: 'In Review',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  published: {
    label: 'Published',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function LifecycleStatus({ state, size = 'md' }: LifecycleStatusProps) {
  const config = stateConfig[state] || stateConfig.draft;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

export default LifecycleStatus;
