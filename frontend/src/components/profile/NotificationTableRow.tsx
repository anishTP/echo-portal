import { memo, useCallback } from 'react';
import { Flex, Text, Checkbox } from '@radix-ui/themes';
import {
  ChatBubbleIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  BellIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import { formatRelativeTime } from '../../utils/format-time';
import type { Notification } from '@echo-portal/shared';

interface NotificationTableRowProps {
  notification: Notification;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (notification: Notification) => void;
}

const typeIcons: Record<string, { icon: typeof BellIcon; color: string }> = {
  review_requested: { icon: ChatBubbleIcon, color: 'var(--blue-9)' },
  review_comment_added: { icon: ChatBubbleIcon, color: 'var(--blue-9)' },
  review_comment_reply: { icon: ChatBubbleIcon, color: 'var(--blue-9)' },
  review_approved: { icon: CheckCircledIcon, color: 'var(--green-9)' },
  review_changes_requested: { icon: ExclamationTriangleIcon, color: 'var(--red-9)' },
  review_comment_resolved: { icon: CheckCircledIcon, color: 'var(--green-9)' },
  reviewer_added: { icon: PersonIcon, color: 'var(--violet-9)' },
  reviewer_removed: { icon: PersonIcon, color: 'var(--gray-9)' },
  collaborator_added: { icon: PersonIcon, color: 'var(--violet-9)' },
  collaborator_removed: { icon: PersonIcon, color: 'var(--gray-9)' },
  content_published: { icon: CheckCircledIcon, color: 'var(--green-9)' },
  branch_archived: { icon: BellIcon, color: 'var(--gray-9)' },
  branch_ready_to_publish: { icon: BellIcon, color: 'var(--amber-9)' },
  role_changed: { icon: PersonIcon, color: 'var(--orange-9)' },
  ai_compliance_error: { icon: ExclamationTriangleIcon, color: 'var(--red-9)' },
};

const reasonLabels: Record<string, string> = {
  review_requested: 'Review Request',
  review_comment_added: 'Comment',
  review_comment_reply: 'Reply',
  review_approved: 'Approved',
  review_changes_requested: 'Changes Requested',
  review_comment_resolved: 'Resolved',
  reviewer_added: 'Reviewer Added',
  reviewer_removed: 'Reviewer Removed',
  collaborator_added: 'Collaborator Added',
  collaborator_removed: 'Collaborator Removed',
  content_published: 'Published',
  branch_archived: 'Archived',
  branch_ready_to_publish: 'Ready to Publish',
  role_changed: 'Role Changed',
  ai_compliance_error: 'AI Alert',
};

export const NotificationTableRow = memo(function NotificationTableRow({
  notification,
  selected,
  onSelect,
  onClick,
}: NotificationTableRowProps) {
  const iconConfig = typeIcons[notification.type] ?? { icon: BellIcon, color: 'var(--gray-9)' };
  const Icon = iconConfig.icon;
  const reason = reasonLabels[notification.type] ?? notification.type;

  const handleCheckbox = useCallback(
    (checked: boolean | 'indeterminate') => {
      onSelect(notification.id, checked === true);
    },
    [notification.id, onSelect]
  );

  return (
    <Flex
      align="center"
      gap="3"
      px="4"
      py="3"
      style={{
        background: notification.isRead ? 'transparent' : 'var(--accent-2)',
        cursor: 'pointer',
        borderBottom: '1px solid var(--gray-4)',
      }}
      onClick={() => onClick(notification)}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={handleCheckbox}
        onClick={(e) => e.stopPropagation()}
      />

      <div style={{ color: iconConfig.color, flexShrink: 0 }}>
        <Icon width={16} height={16} />
      </div>

      <Flex direction="column" gap="0" style={{ flex: 1, minWidth: 0 }}>
        <Text size="2" weight={notification.isRead ? 'regular' : 'bold'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {notification.title}
        </Text>
        <Text size="1" color="gray" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {notification.message}
        </Text>
      </Flex>

      <Flex align="center" gap="3" style={{ flexShrink: 0 }}>
        <Text size="1" color="gray" style={{ whiteSpace: 'nowrap' }}>
          {reason}
        </Text>

        {notification.actorName && (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--gray-4)',
              color: 'var(--gray-11)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              flexShrink: 0,
            }}
            title={notification.actorName}
          >
            {notification.actorName.charAt(0).toUpperCase()}
          </div>
        )}

        <Text size="1" color="gray" style={{ whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </Flex>
    </Flex>
  );
});
