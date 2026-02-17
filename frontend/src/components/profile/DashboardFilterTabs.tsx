import { Flex, Button, Text } from '@radix-ui/themes';

export type DashboardFilter = 'my' | 'review' | 'publish' | 'all';

interface DashboardFilterTabsProps {
  activeFilter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  counts: {
    my: number;
    review: number;
    publish: number;
    all: number;
  };
  showPublish?: boolean;
}

const tabs: { key: DashboardFilter; label: string }[] = [
  { key: 'my', label: 'My Branches' },
  { key: 'review', label: 'To Review' },
  { key: 'publish', label: 'To Publish' },
  { key: 'all', label: 'All' },
];

export function DashboardFilterTabs({
  activeFilter,
  onFilterChange,
  counts,
  showPublish = false,
}: DashboardFilterTabsProps) {
  const visibleTabs = showPublish ? tabs : tabs.filter((t) => t.key !== 'publish');

  return (
    <Flex gap="2" wrap="wrap">
      {visibleTabs.map(({ key, label }) => {
        const isActive = activeFilter === key;
        return (
          <Button
            key={key}
            variant={isActive ? 'solid' : 'soft'}
            size="2"
            onClick={() => onFilterChange(key)}
            style={{ gap: 6 }}
          >
            {label}
            <Text
              size="1"
              weight="bold"
              style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--gray-a3)',
                borderRadius: 9999,
                padding: '1px 7px',
                minWidth: 20,
                textAlign: 'center',
              }}
            >
              {counts[key]}
            </Text>
          </Button>
        );
      })}
    </Flex>
  );
}
