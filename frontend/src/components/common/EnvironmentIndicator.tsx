interface EnvironmentIndicatorProps {
  environment: 'main' | 'dev' | 'branch';
  branchName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const envConfig: Record<
  'main' | 'dev' | 'branch',
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  main: {
    label: 'Published',
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  dev: {
    label: 'Development',
    color: 'text-purple-800',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  branch: {
    label: 'Branch',
    color: 'text-orange-800',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function EnvironmentIndicator({
  environment,
  branchName,
  size = 'md',
}: EnvironmentIndicatorProps) {
  const config = envConfig[environment];
  const displayLabel = environment === 'branch' && branchName ? branchName : config.label;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded border font-medium ${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses[size]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          environment === 'main'
            ? 'bg-green-500'
            : environment === 'dev'
              ? 'bg-purple-500'
              : 'bg-orange-500'
        }`}
      />
      <span>{displayLabel}</span>
    </div>
  );
}

export default EnvironmentIndicator;
