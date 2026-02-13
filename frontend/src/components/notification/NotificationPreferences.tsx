import { Switch, Text } from '@radix-ui/themes';
import { useNotificationPreferences, useUpdatePreference } from '../../hooks/useNotifications';

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  review: {
    label: 'Review Events',
    description: 'Notifications about review requests, comments, approvals, and changes requested on your branches.',
  },
  lifecycle: {
    label: 'Lifecycle Events',
    description: 'Notifications when you are added/removed as a collaborator, content is published, branches are archived, or your role changes.',
  },
  ai: {
    label: 'AI Events',
    description: 'Notifications when AI compliance analysis detects issues with images on your branch content.',
  },
};

export function NotificationPreferences() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreference();

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading preferences...</div>;
  }

  return (
    <div className="space-y-4">
      {(preferences ?? []).map((pref) => {
        const info = CATEGORY_INFO[pref.category];
        if (!info) return null;

        return (
          <div
            key={pref.category}
            className="flex items-start justify-between rounded-lg border border-gray-200 p-4"
          >
            <div className="flex-1 pr-4">
              <Text as="p" size="3" weight="medium">
                {info.label}
              </Text>
              <Text as="p" size="2" color="gray" className="mt-1">
                {info.description}
              </Text>
            </div>
            <Switch
              checked={pref.enabled}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ category: pref.category, enabled: checked })
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export default NotificationPreferences;
