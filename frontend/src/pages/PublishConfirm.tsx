import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@radix-ui/themes';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../hooks/useBranch';
import {
  useValidateConvergence,
  usePublishBranch,
  useLatestConvergence,
} from '../hooks/useConvergence';
import {
  ConvergenceStatus,
  ConvergenceStatusDetail,
} from '../components/convergence/ConvergenceStatus';
import { ConflictDisplay } from '../components/convergence/ConflictDisplay';
import { LifecycleStatus } from '../components/branch/LifecycleStatus';
import type { BranchStateType } from '@echo-portal/shared';

export default function PublishConfirm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const { data: branch, isLoading: loadingBranch } = useBranch(id);
  const {
    data: validation,
    isLoading: loadingValidation,
    refetch: refetchValidation,
  } = useValidateConvergence(id);
  const { data: latestConvergence } = useLatestConvergence(id);

  const publishBranch = usePublishBranch();

  const [isPublishing, setIsPublishing] = useState(false);

  const canPublish =
    branch?.state === 'approved' &&
    validation?.isValid &&
    (user?.roles?.includes('administrator') || user?.roles?.includes('administrator'));

  const handlePublish = async () => {
    if (!id) return;

    setIsPublishing(true);
    try {
      const result = await publishBranch.mutateAsync(id);
      if (result.summary.isSucceeded) {
        navigate(`/branches/${id}`);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Sign in required</h2>
          <p className="mt-2 text-gray-600">Please sign in to publish branches.</p>
        </div>
      </div>
    );
  }

  if (loadingBranch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Branch not found</h2>
          <Link to="/dashboard" className="mt-4 text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/branches/${id}`}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Publish Branch
                </h1>
                <p className="text-gray-600">{branch.name}</p>
              </div>
            </div>
            <LifecycleStatus state={branch.state as BranchStateType} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl py-6 sm:px-6 lg:px-8">
        <div className="space-y-6 px-4 sm:px-0">
          {/* Branch Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">
              Branch Information
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Target</dt>
                <dd className="mt-1 font-mono text-gray-900">{branch.baseRef}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Git Reference</dt>
                <dd className="mt-1 font-mono text-gray-900">{branch.gitRef}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Base Commit</dt>
                <dd className="mt-1 font-mono text-gray-900">
                  {branch.baseCommit.slice(0, 8)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Head Commit</dt>
                <dd className="mt-1 font-mono text-gray-900">
                  {branch.headCommit.slice(0, 8)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Validation Results */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Pre-Publish Validation
              </h2>
              <Button
                variant="ghost"
                size="2"
                onClick={() => refetchValidation()}
                disabled={loadingValidation}
              >
                {loadingValidation ? 'Checking...' : 'Re-check'}
              </Button>
            </div>

            {loadingValidation ? (
              <div className="mt-4 flex items-center gap-2 text-gray-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Running validation checks...
              </div>
            ) : validation ? (
              <div className="mt-4">
                <ConflictDisplay
                  conflicts={validation.conflicts}
                  validationResults={validation.results}
                />
              </div>
            ) : null}
          </div>

          {/* Previous Convergence */}
          {latestConvergence && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900">
                Previous Publish Attempt
              </h2>
              <div className="mt-4">
                <ConvergenceStatusDetail
                  status={latestConvergence.status}
                  startedAt={latestConvergence.startedAt}
                  completedAt={latestConvergence.completedAt}
                  mergeCommit={latestConvergence.mergeCommit}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Link
              to={`/branches/${id}`}
              className="rounded-md bg-white px-6 py-3 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <Button
              color="purple"
              size="2"
              onClick={handlePublish}
              disabled={!canPublish || isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Publish to Main'}
            </Button>
          </div>

          {/* Help Text */}
          {!canPublish && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">
              {branch.state !== 'approved' && (
                <p>Branch must be approved before it can be published.</p>
              )}
              {validation && !validation.isValid && (
                <p>All validation checks must pass before publishing.</p>
              )}
              {!user?.roles?.includes('administrator') &&
                !user?.roles?.includes('administrator') && (
                  <p>You need publisher or administrator role to publish.</p>
                )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
