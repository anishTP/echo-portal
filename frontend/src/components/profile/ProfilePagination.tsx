import { Button, Text, Flex } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

interface ProfilePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function ProfilePagination({ page, limit, total, onPageChange }: ProfilePaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const totalPages = Math.ceil(total / limit);

  return (
    <Flex align="center" justify="between" py="3" px="4">
      <Text size="2" color="gray">
        {start}-{end} of {total}
      </Text>
      <Flex gap="2">
        <Button
          variant="soft"
          size="1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
          Prev
        </Button>
        <Button
          variant="soft"
          size="1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </Flex>
    </Flex>
  );
}
