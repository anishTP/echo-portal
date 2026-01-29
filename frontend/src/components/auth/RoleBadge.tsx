import { Badge } from '@radix-ui/themes';
import type { RoleType } from '@echo-portal/shared';

interface RoleBadgeProps {
  role: RoleType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

// Map roles to Radix Badge colors
const roleConfig: Record<
  RoleType,
  { label: string; color: 'gray' | 'blue' | 'purple' | 'red'; icon: string }
> = {
  viewer: {
    label: 'Viewer',
    color: 'gray',
    icon: '👁️',
  },
  contributor: {
    label: 'Contributor',
    color: 'blue',
    icon: '✏️',
  },
  reviewer: {
    label: 'Reviewer',
    color: 'purple',
    icon: '🔍',
  },
  administrator: {
    label: 'Administrator',
    color: 'red',
    icon: '⚙️',
  },
};

const sizeMap = {
  sm: '1' as const,
  md: '2' as const,
  lg: '3' as const,
};

export function RoleBadge({ role, size = 'md', showIcon = true }: RoleBadgeProps) {
  const config = roleConfig[role];

  if (!config) {
    return null;
  }

  return (
    <Badge
      color={config.color}
      variant="soft"
      size={sizeMap[size]}
      radius="full"
      title={`Role: ${config.label}`}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </Badge>
  );
}

export default RoleBadge;
