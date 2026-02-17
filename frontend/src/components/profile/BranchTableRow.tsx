import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Text, Flex, IconButton, Badge } from '@radix-ui/themes';
import { TrashIcon } from '@radix-ui/react-icons';
import { LifecycleStatus } from '../branch/LifecycleStatus';
import { formatRelativeTime } from '../../utils/format-time';
import type { BranchResponse } from '../../services/branchService';
import type { BranchStateType } from '@echo-portal/shared';

interface BranchTableRowProps {
  branch: BranchResponse;
  currentUserId?: string;
  onDelete?: (branchId: string) => void;
}

function hasChangesRequested(branch: BranchResponse): boolean {
  return (
    branch.state === 'review' &&
    !!branch.reviews?.some((r) => r.decision === 'changes_requested')
  );
}

export const BranchTableRow = memo(function BranchTableRow({
  branch,
  currentUserId,
  onDelete,
}: BranchTableRowProps) {
  const displayName = branch.ownerName || branch.ownerId.slice(0, 8);
  const canDelete = branch.state === 'draft' && branch.ownerId === currentUserId;
  const showChangesRequested = hasChangesRequested(branch);

  return (
    <Table.Row>
      {/* BRANCH */}
      <Table.Cell>
        <Flex direction="column" gap="1">
          <Link
            to={`/branches/${branch.id}`}
            style={{ textDecoration: 'none', color: 'var(--gray-12)' }}
          >
            <Text size="2" weight="bold">
              {branch.name}
            </Text>
          </Link>
          {branch.description && (
            <Text size="1" color="gray" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {branch.description}
            </Text>
          )}
        </Flex>
      </Table.Cell>

      {/* AUTHOR */}
      <Table.Cell>
        <Flex align="center" gap="2">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--accent-3)',
              color: 'var(--accent-11)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <Text size="1" color="gray">
            {displayName}
          </Text>
        </Flex>
      </Table.Cell>

      {/* STATUS */}
      <Table.Cell>
        {showChangesRequested ? (
          <Badge color="red" variant="soft" size="1" radius="full">
            Changes Requested
          </Badge>
        ) : (
          <LifecycleStatus state={branch.state as BranchStateType} size="sm" />
        )}
      </Table.Cell>

      {/* LAST UPDATE */}
      <Table.Cell>
        <Text size="1" color="gray">
          {formatRelativeTime(branch.updatedAt)}
        </Text>
      </Table.Cell>

      {/* ACTIONS */}
      <Table.Cell>
        {canDelete && onDelete && (
          <IconButton
            variant="ghost"
            size="1"
            color="red"
            onClick={(e) => {
              e.preventDefault();
              onDelete(branch.id);
            }}
          >
            <TrashIcon />
          </IconButton>
        )}
      </Table.Cell>
    </Table.Row>
  );
});
