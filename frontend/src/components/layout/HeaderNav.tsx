import { useNavigate, useSearchParams } from 'react-router-dom';
import { DropdownMenu, Button, Text, Flex, Spinner } from '@radix-ui/themes';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useCategories } from '../../hooks/usePublishedContent';

export function HeaderNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section');
  const { categories, categoryCounts, isLoading } = useCategories();

  const isActive = (s: string) => section === s;

  const handleCategoryClick = (sectionName: string, category: string) => {
    navigate(`/library?section=${sectionName}&category=${encodeURIComponent(category)}`);
  };

  const handleSectionClick = (sectionName: string) => {
    navigate(`/library?section=${sectionName}`);
  };

  const dropdownItems = (sectionName: string) => {
    if (isLoading) {
      return (
        <Flex align="center" justify="center" py="3">
          <Spinner size="2" />
        </Flex>
      );
    }

    if (categories.length === 0) {
      return (
        <Flex align="center" justify="center" py="2" px="3">
          <Text size="2" style={{ color: 'var(--gray-9)' }}>No categories yet</Text>
        </Flex>
      );
    }

    return categories.map((cat) => (
      <DropdownMenu.Item
        key={cat}
        onClick={() => handleCategoryClick(sectionName, cat)}
      >
        <Flex align="center" justify="between" width="100%">
          <Text size="2">{cat}</Text>
          <Text size="1" style={{ color: 'var(--gray-9)' }}>
            {categoryCounts[cat] ?? 0}
          </Text>
        </Flex>
      </DropdownMenu.Item>
    ));
  };

  return (
    <nav className="flex items-center gap-1">
      {/* Brands dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button
            variant="ghost"
            size="2"
            style={{ color: isActive('brands') ? 'var(--accent-11)' : 'var(--gray-11)' }}
          >
            <Text size="2" weight="medium">Brands</Text>
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content style={{ minWidth: '180px' }}>
          <DropdownMenu.Item onClick={() => handleSectionClick('brands')}>
            <Text size="2" weight="medium">All Brands</Text>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          {dropdownItems('brands')}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* Products dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button
            variant="ghost"
            size="2"
            style={{ color: isActive('products') ? 'var(--accent-11)' : 'var(--gray-11)' }}
          >
            <Text size="2" weight="medium">Products</Text>
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content style={{ minWidth: '180px' }}>
          <DropdownMenu.Item onClick={() => handleSectionClick('products')}>
            <Text size="2" weight="medium">All Products</Text>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          {dropdownItems('products')}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {/* Experiences link */}
      <Button
        variant="ghost"
        size="2"
        onClick={() => handleSectionClick('experiences')}
        style={{ color: isActive('experiences') ? 'var(--accent-11)' : 'var(--gray-11)' }}
      >
        <Text size="2" weight="medium">Experiences</Text>
      </Button>
    </nav>
  );
}
