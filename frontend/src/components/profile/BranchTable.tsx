import { Table, Text } from '@radix-ui/themes';
import { BranchTableRow } from './BranchTableRow';
import type { BranchResponse } from '../../services/branchService';

interface BranchTableProps {
  branches: BranchResponse[];
  isLoading?: boolean;
  currentUserId?: string;
  onDelete?: (branchId: string) => void;
}

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Table.Row key={i}>
          <Table.Cell>
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          </Table.Cell>
          <Table.Cell>
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          </Table.Cell>
          <Table.Cell>
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          </Table.Cell>
          <Table.Cell>
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          </Table.Cell>
          <Table.Cell>
            <div className="h-4 w-8 animate-pulse rounded bg-gray-200" />
          </Table.Cell>
        </Table.Row>
      ))}
    </>
  );
}

export function BranchTable({ branches, isLoading, currentUserId, onDelete }: BranchTableProps) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>BRANCH</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>AUTHOR</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>STATUS</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>LAST UPDATE</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell style={{ width: 48 }}>ACTIONS</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {isLoading ? (
          <TableSkeleton />
        ) : branches.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={5}>
              <Text size="2" color="gray" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>
                No branches found
              </Text>
            </Table.Cell>
          </Table.Row>
        ) : (
          branches.map((branch) => (
            <BranchTableRow
              key={branch.id}
              branch={branch}
              currentUserId={currentUserId}
              onDelete={onDelete}
            />
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
