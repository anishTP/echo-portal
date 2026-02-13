import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationList } from '../components/notification/NotificationList';

export function Notifications() {
  const [page, setPage] = useState(1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <Link
          to="/settings/notifications"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Notification Settings
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <NotificationList mode="full" page={page} onPageChange={setPage} />
      </div>
    </main>
  );
}

export default Notifications;
