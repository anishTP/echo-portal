import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBranch, useUpdateBranch } from '../hooks/useBranch';
import { BranchDetail } from '../components/branch/BranchDetail';
import { useAuth } from '../context/AuthContext';
import type { BranchUpdateInput, VisibilityType } from '@echo-portal/shared';

export default function BranchWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: branch, isLoading, error } = useBranch(id);
  const updateBranch = useUpdateBranch();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<BranchUpdateInput>({});

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">No branch ID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-32 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800">Branch Not Found</h2>
            <p className="mt-2 text-red-600">
              {error instanceof Error ? error.message : 'The requested branch could not be found.'}
            </p>
            <Link
              to="/dashboard"
              className="mt-4 inline-block rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditForm({
      name: branch.name,
      description: branch.description || '',
      visibility: branch.visibility as VisibilityType,
      labels: branch.labels,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      await updateBranch.mutateAsync({ id: branch.id, input: editForm });
      setIsEditing(false);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/dashboard" className="hover:text-gray-700">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900">{branch.name}</span>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        {isEditing ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Branch</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  rows={3}
                  value={editForm.description || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-visibility" className="block text-sm font-medium text-gray-700">
                  Visibility
                </label>
                <select
                  id="edit-visibility"
                  value={editForm.visibility || 'private'}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      visibility: e.target.value as VisibilityType,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateBranch.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateBranch.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <BranchDetail branch={branch} onEdit={handleStartEdit} />
        )}

        {/* Workspace Area - Placeholder for future content editing */}
        {branch.permissions.canEdit && !isEditing && (
          <div className="mt-8 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <h3 className="text-lg font-medium text-gray-700">Content Workspace</h3>
            <p className="mt-2 text-gray-500">
              Content editing features will be available here. You can modify files, preview
              changes, and commit your work.
            </p>
            <p className="mt-4 text-sm text-gray-400">
              Coming in future iterations
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
