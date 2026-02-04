import { useState } from 'react';
import { Button } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';
import { useMyBranches, useReviewBranches, useBranchList } from '../hooks/useBranch';
import { BranchList, BranchCreate } from '../components/branch';

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check if user can publish (admin or publisher role)
  const canPublish = user?.roles?.some(
    (role: string) => role === 'administrator' || role === 'publisher'
  );

  const { data: myBranches = [], isLoading: loadingMyBranches } = useMyBranches(true);
  const { data: reviewBranches = [], isLoading: loadingReviews } = useReviewBranches();

  // Fetch approved branches ready for publishing (only for admins/publishers)
  // The hook is only enabled when user has publish permission
  const { data: approvedBranchesData, isLoading: loadingApproved } = useBranchList({
    state: ['approved'],
    limit: 20,
  });
  // Only show approved branches to users with publish permission
  const approvedBranches = canPublish ? (approvedBranchesData?.data ?? []) : [];

  const draftCount = myBranches.filter((b) => b.state === 'draft').length;
  const inReviewCount = myBranches.filter((b) => b.state === 'review').length;
  const archivedBranches = myBranches.filter((b) => b.state === 'archived');
  const archivedCount = archivedBranches.length;
  const activeBranches = myBranches.filter((b) => b.state !== 'archived');

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isAuthenticated ? (
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-2 text-gray-600">Manage your branches and reviews.</p>
            </div>

            {/* Stats Cards */}
            <div className={`grid grid-cols-1 gap-4 ${canPublish ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
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
              {canPublish && (
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="font-medium text-gray-900">Ready to Publish</h3>
                  <p className="mt-2 text-3xl font-bold text-purple-600">{approvedBranches.length}</p>
                  <p className="text-sm text-gray-500">Approved & waiting</p>
                </div>
              )}
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="font-medium text-gray-900">Archived</h3>
                <p className="mt-2 text-3xl font-bold text-gray-400">{archivedCount}</p>
                <p className="text-sm text-gray-500">Completed work</p>
              </div>
            </div>

            {/* Ready to Publish Section (for admins/publishers) */}
            {canPublish && approvedBranches.length > 0 && (
              <section>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Ready to Publish</h2>
                  <p className="text-sm text-gray-500">
                    These branches have been approved and are waiting for publication.
                  </p>
                </div>
                <BranchList
                  branches={approvedBranches}
                  isLoading={loadingApproved}
                  showOwner
                />
              </section>
            )}

            {/* My Branches Section */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">My Branches</h2>
                <Button size="2" onClick={() => setShowCreateModal(true)}>
                  New Branch
                </Button>
              </div>
              <BranchList
                branches={activeBranches}
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
                  showReviewAction
                />
              </section>
            )}

            {/* Archived Branches Section */}
            {archivedBranches.length > 0 && (
              <section>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-500">Archived Branches</h2>
                  <p className="text-sm text-gray-400">
                    These branches have been published and archived. No further edits are possible.
                  </p>
                </div>
                <BranchList
                  branches={archivedBranches}
                  isLoading={loadingMyBranches}
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
