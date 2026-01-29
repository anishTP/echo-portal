import { Visibility, type VisibilityType } from '@echo-portal/shared';
import { DropdownMenu, Button, Text, Card, Flex, RadioGroup } from '@radix-ui/themes';
import { CheckIcon, ChevronDownIcon, LockClosedIcon, PersonIcon, GlobeIcon } from '@radix-ui/react-icons';

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
    icon: <LockClosedIcon width="18" height="18" />,
  },
  {
    value: Visibility.TEAM,
    label: 'Team',
    description: 'All team members with reviewer or publisher roles can see this branch',
    icon: <PersonIcon width="18" height="18" />,
  },
  {
    value: Visibility.PUBLIC,
    label: 'Public',
    description: 'Anyone with access to the portal can see this branch',
    icon: <GlobeIcon width="18" height="18" />,
  },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: VisibilitySelectorProps) {
  const selectedOption = visibilityOptions.find((opt) => opt.value === value);

  if (compact) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={disabled}>
          <Button variant="outline" disabled={disabled}>
            <span style={{ color: 'var(--gray-11)' }}>{selectedOption?.icon}</span>
            {selectedOption?.label}
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content style={{ minWidth: '280px' }}>
          {visibilityOptions.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onClick={() => onChange(option.value)}
            >
              <Flex gap="3" align="start" style={{ width: '100%' }}>
                <span style={{ color: option.value === value ? 'var(--accent-11)' : 'var(--gray-11)' }}>
                  {option.icon}
                </span>
                <Flex direction="column" style={{ flex: 1 }}>
                  <Text size="2" weight="medium">{option.label}</Text>
                  <Text size="1" color="gray">{option.description}</Text>
                </Flex>
                {option.value === value && (
                  <CheckIcon style={{ color: 'var(--accent-11)' }} />
                )}
              </Flex>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
  }

  return (
    <div className="space-y-2">
      <Text as="label" size="2" weight="medium">Visibility</Text>
      <RadioGroup.Root value={value} onValueChange={(v) => onChange(v as VisibilityType)} disabled={disabled}>
        <Flex direction="column" gap="2">
          {visibilityOptions.map((option) => (
            <Card
              key={option.value}
              asChild
              style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                borderColor: option.value === value ? 'var(--accent-9)' : 'var(--gray-6)',
                backgroundColor: option.value === value ? 'var(--accent-3)' : undefined,
              }}
            >
              <label className="flex items-start gap-4 p-4">
                <RadioGroup.Item value={option.value} className="mt-1" />
                <span style={{ color: option.value === value ? 'var(--accent-11)' : 'var(--gray-11)' }}>
                  {option.icon}
                </span>
                <div className="flex-1">
                  <Text as="div" size="2" weight="medium">{option.label}</Text>
                  <Text as="div" size="2" color="gray" className="mt-1">{option.description}</Text>
                </div>
              </label>
            </Card>
          ))}
        </Flex>
      </RadioGroup.Root>
    </div>
  );
}

export default VisibilitySelector;
