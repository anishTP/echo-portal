import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyBranches, useReviewBranches } from '../hooks/useBranch';
import { BranchList, BranchCreate } from '../components/branch';

export default function Dashboard() {
  const { user, isAuthenticated, login, loginDev, logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: myBranches = [], isLoading: loadingMyBranches } = useMyBranches();
  const { data: reviewBranches = [], isLoading: loadingReviews } = useReviewBranches();

  const draftCount = myBranches.filter((b) => b.state === 'draft').length;
  const inReviewCount = myBranches.filter((b) => b.state === 'review').length;
  const publishedCount = myBranches.filter((b) => b.state === 'published').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Echo Portal</h1>
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-600">Welcome, {user?.displayName || user?.email}</span>
                <button
                  onClick={() => logout()}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => loginDev()}
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-500"
                >
                  Dev Login
                </button>
                <button
                  onClick={() => login('github')}
                  className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
                >
                  Sign in with GitHub
                </button>
                <button
                  onClick={() => login('google')}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isAuthenticated ? (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="font-medium text-gray-900">Draft Branches</h3>
                  <p className="mt-2 text-3xl font-bold text-gray-600">{draftCount}</p>
                  <p className="text-sm text-gray-500">Work in progress</p>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="font-medium text-gray-900">In Review</h3>
                  <p className="mt-2 text-3xl font-bold text-yellow-600">{inReviewCount}</p>
                  <p className="text-sm text-gray-500">Awaiting approval</p>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="font-medium text-gray-900">To Review</h3>
                  <p className="mt-2 text-3xl font-bold text-blue-600">{reviewBranches.length}</p>
                  <p className="text-sm text-gray-500">Assigned to you</p>
                </div>
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="font-medium text-gray-900">Published</h3>
                  <p className="mt-2 text-3xl font-bold text-green-600">{publishedCount}</p>
                  <p className="text-sm text-gray-500">Live on main</p>
                </div>
              </div>

              {/* My Branches Section */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">My Branches</h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    New Branch
                  </button>
                </div>
                <BranchList
                  branches={myBranches}
                  isLoading={loadingMyBranches}
                  emptyMessage="You don't have any branches yet. Create one to get started!"
                />
              </section>

              {/* Review Queue Section */}
              {reviewBranches.length > 0 && (
                <section>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Branches to Review</h2>
                  </div>
                  <BranchList
                    branches={reviewBranches.slice(0, 5)}
                    isLoading={loadingReviews}
                    showOwner
                  />
                </section>
              )}
            </div>
          ) : (
            <div className="rounded-lg border-4 border-dashed border-gray-200 p-8">
              <h2 className="mb-4 text-xl font-semibold text-gray-700">
                Branch Isolation Model
              </h2>
              <p className="mb-6 text-gray-600">
                Welcome to Echo Portal. This is the branch isolation model implementation for
                governed contribution workflows.
              </p>
              <div className="border-l-4 border-gray-400 bg-gray-50 p-4">
                <p className="text-gray-700">
                  Sign in to create branches and contribute to the documentation.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Branch</h2>
            <BranchCreate
              onSuccess={(branchId) => {
                setShowCreateModal(false);
                window.location.href = `/branches/${branchId}`;
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
