import { Button, Flex, Text } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <Flex justify="between" align="center" py="3" px="4" className="border-t border-[var(--gray-6)]">
      {/* Mobile view */}
      <Flex gap="3" className="sm:hidden" style={{ flex: 1 }} justify="between">
        <Button
          variant="outline"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrev}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
        >
          Next
        </Button>
      </Flex>

      {/* Desktop view */}
      <Flex className="hidden sm:flex" style={{ flex: 1 }} justify="between" align="center">
        <Text size="2" color="gray">
          Showing page <Text weight="medium">{page}</Text> of{' '}
          <Text weight="medium">{totalPages}</Text>
          {' - '}
          <Text weight="medium">{totalItems}</Text> results
        </Text>

        <Flex gap="1" align="center">
          <Button
            variant="ghost"
            size="2"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrev}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous</span>
          </Button>
          <Text size="2" weight="medium" style={{ minWidth: '2rem', textAlign: 'center' }}>
            {page}
          </Text>
          <Button
            variant="ghost"
            size="2"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next</span>
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}

export default Pagination;
