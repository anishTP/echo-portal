import { memo } from 'react';
import { IconButton } from '@radix-ui/themes';
import { useUnreadCount } from '../../hooks/useNotifications';

interface NotificationBellProps {
  onClick?: () => void;
}

export const NotificationBell = memo(function NotificationBell({ onClick }: NotificationBellProps) {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <div className="relative">
      <IconButton
        variant="ghost"
        size="2"
        onClick={onClick}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </IconButton>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
});

export default NotificationBell;
