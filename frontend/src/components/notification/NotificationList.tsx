import { memo, useCallback } from 'react';
import { Button } from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationList, useMarkNotificationRead, useMarkAllRead } from '../../hooks/useNotifications';
import type { Notification } from '@echo-portal/shared';

interface NotificationListProps {
  mode?: 'popover' | 'full';
  maxItems?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onClose?: () => void;
}

export function NotificationList({
  mode = 'full',
  maxItems,
  page = 1,
  onPageChange,
  onClose,
}: NotificationListProps) {
  const limit = mode === 'popover' ? (maxItems ?? 5) : 20;
  const { data, isLoading } = useNotificationList({ page, limit });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllRead();
  const navigate = useNavigate();

  const handleMarkRead = useCallback(
    (notificationId: string) => {
      markReadMutation.mutate(notificationId);
    },
    [markReadMutation]
  );

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  const handleShowAll = useCallback(() => {
    onClose?.();
    navigate('/notifications');
  }, [navigate, onClose]);

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading notifications...</div>;
  }

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  return (
    <div className={mode === 'popover' ? 'max-h-96 overflow-y-auto' : ''}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Button
              variant="ghost"
              size="1"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
          {mode === 'popover' && onClose && (
            <Button variant="ghost" size="1" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">No notifications yet</div>
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

      {mode === 'popover' && (
        <div className="border-t border-gray-200 px-4 py-3 text-center">
          <Button variant="ghost" size="1" onClick={handleShowAll}>
            {total > limit ? `Show all (${total})` : 'View all notifications'}
          </Button>
        </div>
      )}

      {mode === 'full' && total > limit && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <Button
            variant="ghost"
            size="1"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <Button
            variant="ghost"
            size="1"
            disabled={!hasMore}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
          </Button>
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
