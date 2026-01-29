import { Badge } from '@radix-ui/themes';
import type { BranchStateType } from '@echo-portal/shared';

interface LifecycleStatusProps {
  state: BranchStateType;
  size?: 'sm' | 'md' | 'lg';
}

// Map branch states to Radix Badge colors
const stateConfig: Record<
  BranchStateType,
  { label: string; color: 'gray' | 'yellow' | 'green' | 'blue' }
> = {
  draft: {
    label: 'Draft',
    color: 'gray',
  },
  review: {
    label: 'In Review',
    color: 'yellow',
  },
  approved: {
    label: 'Approved',
    color: 'green',
  },
  published: {
    label: 'Published',
    color: 'blue',
  },
  archived: {
    label: 'Archived',
    color: 'gray',
  },
};

const sizeMap = {
  sm: '1' as const,
  md: '2' as const,
  lg: '3' as const,
};

export function LifecycleStatus({ state, size = 'md' }: LifecycleStatusProps) {
  const config = stateConfig[state] || stateConfig.draft;

  return (
    <Badge
      color={config.color}
      variant="soft"
      size={sizeMap[size]}
      radius="full"
    >
      {config.label}
    </Badge>
  );
}

export default LifecycleStatus;
