import { memo, useCallback } from 'react';
import { Button } from '@radix-ui/themes';
import { useNotificationList, useMarkNotificationRead } from '../../hooks/useNotifications';
import type { Notification } from '@echo-portal/shared';

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const { data, isLoading } = useNotificationList();
  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = useCallback(
    (notificationId: string) => {
      markReadMutation.mutate(notificationId);
    },
    [markReadMutation]
  );

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading notifications...</div>;
  }

  const notifications = data?.items ?? [];

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {onClose && (
          <Button variant="ghost" size="1" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">No notifications</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

const NotificationItem = memo(function NotificationItem({
  notification,
  onMarkRead,
}: NotificationItemProps) {
  const formattedDate = new Date(notification.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={`px-4 py-3 ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
          <p className="mt-0.5 text-sm text-gray-600">{notification.message}</p>
          <p className="mt-1 text-xs text-gray-400">{formattedDate}</p>
        </div>
        {!notification.isRead && (
          <div className="ml-2 mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
        )}
      </div>
    </div>
  );
});

export default NotificationList;
