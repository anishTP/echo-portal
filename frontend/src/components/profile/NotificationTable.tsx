import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Text, Button, TextField, Checkbox, SegmentedControl } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useNotificationList, useMarkNotificationRead, useMarkAllRead } from '../../hooks/useNotifications';
import { NotificationTableRow } from './NotificationTableRow';
import { ProfilePagination } from './ProfilePagination';
import { getDateGroup } from '../../utils/format-time';
import api from '../../services/api';
import type { Notification } from '@echo-portal/shared';

const PAGE_LIMIT = 20;

interface NotificationTableProps {
  readFilter: 'all' | 'unread';
  onReadFilterChange: (filter: 'all' | 'unread') => void;
}

export function NotificationTable({ readFilter, onReadFilterChange }: NotificationTableProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupByDate, setGroupByDate] = useState(true);

  const isReadParam = readFilter === 'unread' ? false : undefined;
  const { data, isLoading } = useNotificationList({
    isRead: isReadParam,
    page,
    limit: PAGE_LIMIT,
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllRead();

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;

  const filteredNotifications = useMemo(() => {
    if (!search.trim()) return notifications;
    const q = search.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
    );
  }, [notifications, search]);

  const grouped = useMemo(() => {
    if (!groupByDate) return null;
    const groups: { label: string; items: Notification[] }[] = [];
    const groupMap = new Map<string, Notification[]>();

    for (const n of filteredNotifications) {
      const label = getDateGroup(n.createdAt);
      if (!groupMap.has(label)) {
        groupMap.set(label, []);
      }
      groupMap.get(label)!.push(n);
    }

    // Maintain consistent order
    for (const label of ['Today', 'Yesterday', 'Last 7 days', 'Older']) {
      const items = groupMap.get(label);
      if (items?.length) {
        groups.push({ label, items });
      }
    }

    return groups;
  }, [filteredNotifications, groupByDate]);

  const allVisibleIds = filteredNotifications.map((n) => n.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(
    (checked: boolean | 'indeterminate') => {
      if (checked === true) {
        setSelectedIds(new Set(allVisibleIds));
      } else {
        setSelectedIds(new Set());
      }
    },
    [allVisibleIds]
  );

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleMarkSelectedRead = useCallback(() => {
    for (const id of selectedIds) {
      markReadMutation.mutate(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, markReadMutation]);

  const handleNavigate = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        markReadMutation.mutate(notification.id);
      }

      const { resourceType, resourceId } = notification;
      if (!resourceId) return;

      if (resourceType === 'branch') {
        navigate(`/branches/${resourceId}`);
      } else if (resourceType === 'review') {
        try {
          const review = await api.get<{ branchId: string }>(`/reviews/${resourceId}`);
          navigate(`/branches/${review.branchId}`);
        } catch {
          // Review may have been deleted
        }
      }
    },
    [navigate, markReadMutation]
  );

  const renderRows = (items: Notification[]) =>
    items.map((n) => (
      <NotificationTableRow
        key={n.id}
        notification={n}
        selected={selectedIds.has(n.id)}
        onSelect={handleSelect}
        onClick={handleNavigate}
      />
    ));

  return (
    <Flex direction="column" gap="3">
      {/* Toolbar */}
      <Flex align="center" gap="3" wrap="wrap">
        <SegmentedControl.Root
          value={readFilter}
          onValueChange={(v) => {
            onReadFilterChange(v as 'all' | 'unread');
            setPage(1);
          }}
          size="1"
        >
          <SegmentedControl.Item value="all">All</SegmentedControl.Item>
          <SegmentedControl.Item value="unread">Unread</SegmentedControl.Item>
        </SegmentedControl.Root>

        <TextField.Root
          placeholder="Search notifications..."
          size="2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        >
          <TextField.Slot>
            <MagnifyingGlassIcon />
          </TextField.Slot>
        </TextField.Root>

        <Button
          variant="soft"
          size="1"
          onClick={() => setGroupByDate(!groupByDate)}
        >
          {groupByDate ? 'Ungroup' : 'Group by: Date'}
        </Button>
      </Flex>

      {/* Batch actions bar */}
      <Flex align="center" gap="3" px="4" py="2" style={{ borderBottom: '1px solid var(--gray-4)' }}>
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
        />
        <Text size="1" color="gray">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
        </Text>
        {selectedIds.size > 0 && (
          <Button variant="ghost" size="1" onClick={handleMarkSelectedRead}>
            Mark as read
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size="1"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          Mark all as read
        </Button>
      </Flex>

      {/* Content */}
      {isLoading ? (
        <Flex direction="column" gap="2" p="4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </Flex>
      ) : filteredNotifications.length === 0 ? (
        <Flex justify="center" py="8">
          <Text size="2" color="gray">No notifications found</Text>
        </Flex>
      ) : grouped ? (
        <Flex direction="column">
          {grouped.map((group) => (
            <div key={group.label}>
              <Flex px="4" py="2" style={{ background: 'var(--gray-2)' }}>
                <Text size="1" weight="bold" color="gray">
                  {group.label}
                </Text>
              </Flex>
              {renderRows(group.items)}
            </div>
          ))}
        </Flex>
      ) : (
        <Flex direction="column">
          {renderRows(filteredNotifications)}
        </Flex>
      )}

      <ProfilePagination
        page={page}
        limit={PAGE_LIMIT}
        total={total}
        onPageChange={setPage}
      />
    </Flex>
  );
}
