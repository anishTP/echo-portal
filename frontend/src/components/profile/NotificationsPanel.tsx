import { useState } from 'react';
import { Flex, Heading } from '@radix-ui/themes';
import { NotificationTable } from './NotificationTable';

export function NotificationsPanel() {
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');

  return (
    <Flex direction="column" gap="4">
      <Heading size="5">Notifications</Heading>
      <NotificationTable
        readFilter={readFilter}
        onReadFilterChange={setReadFilter}
      />
    </Flex>
  );
}
