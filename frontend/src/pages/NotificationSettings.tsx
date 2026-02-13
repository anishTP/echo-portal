import { Link } from 'react-router-dom';
import { NotificationPreferences } from '../components/notification/NotificationPreferences';

export function NotificationSettings() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/notifications"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Notifications
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control which categories of notifications you receive.
        </p>
      </div>
      <NotificationPreferences />
    </main>
  );
}

export default NotificationSettings;
