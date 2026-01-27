import type { RoleType } from '@echo-portal/shared';

interface RoleBadgeProps {
  role: RoleType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const roleConfig: Record<
  RoleType,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  viewer: {
    label: 'Viewer',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    icon: '👁️',
  },
  contributor: {
    label: 'Contributor',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    icon: '✏️',
  },
  reviewer: {
    label: 'Reviewer',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200',
    icon: '🔍',
  },
  administrator: {
    label: 'Administrator',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    icon: '⚙️',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function RoleBadge({ role, size = 'md', showIcon = true }: RoleBadgeProps) {
  const config = roleConfig[role];

  if (!config) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses[size]}`}
      title={`Role: ${config.label}`}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}

export default RoleBadge;
