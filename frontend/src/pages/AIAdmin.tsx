import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AIConfigPanel } from '../components/ai/AIConfigPanel';
import { AIContextDocuments } from '../components/ai/AIContextDocuments';
import { AIAuditDashboard } from '../components/ai/AIAuditDashboard';

/**
 * AI Admin page — admin-only page for AI configuration and audit.
 * Renders AIConfigPanel and AIAuditDashboard components.
 */
export default function AIAdmin() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole?.('administrator') ?? false;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">AI Administration</h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
              <p className="mt-1 text-sm text-gray-500">
                You need administrator privileges to manage AI settings.
              </p>
              <div className="mt-6">
                <Link
                  to="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Return to Library
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Administration</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure AI assistant settings and view activity audit
              </p>
            </div>
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Library
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 space-y-8 sm:px-0">
          <AIConfigPanel />
          <AIContextDocuments />
          <AIAuditDashboard />
        </div>
      </main>
    </div>
  );
}
