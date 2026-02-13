import { useState, useEffect } from 'react';
import { notificationApi } from '../../services/notification-api';

const PERIOD_LABELS: Record<string, string> = {
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
};

const TYPE_LABELS: Record<string, string> = {
  review_requested: 'Review Requested',
  review_comment_added: 'Comment Added',
  review_comment_reply: 'Comment Reply',
  review_approved: 'Approved',
  review_changes_requested: 'Changes Requested',
  reviewer_added: 'Reviewer Added',
  reviewer_removed: 'Reviewer Removed',
  collaborator_added: 'Collaborator Added',
  collaborator_removed: 'Collaborator Removed',
  content_published: 'Content Published',
  branch_archived: 'Branch Archived',
  role_changed: 'Role Changed',
  ai_compliance_error: 'AI Compliance Error',
};

export function NotificationMetrics() {
  const [metrics, setMetrics] = useState<Record<string, { total: number; byType: Record<string, number> }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationApi
      .getAdminMetrics()
      .then((data) => {
        setMetrics(data.periods);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load metrics');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading notification metrics...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">Error: {error}</div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notification Metrics</h2>
        <p className="mt-1 text-sm text-gray-500">Aggregate notification counts by type and time period.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {Object.entries(PERIOD_LABELS).map(([period, label]) => {
          const data = metrics[period];
          if (!data) return null;

          return (
            <div key={period} className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-500">{label}</h3>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data.total}</p>

              {Object.keys(data.byType).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(data.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{TYPE_LABELS[type] || type}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              )}

              {Object.keys(data.byType).length === 0 && (
                <p className="mt-3 text-sm text-gray-400">No notifications</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NotificationMetrics;
