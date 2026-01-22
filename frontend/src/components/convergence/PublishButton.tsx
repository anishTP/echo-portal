import { useState } from 'react';

interface PublishButtonProps {
  branchId: string;
  branchName: string;
  canPublish: boolean;
  isApproved: boolean;
  onPublish: () => Promise<void>;
}

export function PublishButton({
  branchId,
  branchName,
  canPublish,
  isApproved,
  onPublish,
}: PublishButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      await onPublish();
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const getButtonState = () => {
    if (!isApproved) {
      return {
        disabled: true,
        label: 'Needs Approval',
        className: 'bg-gray-300 text-gray-500 cursor-not-allowed',
      };
    }

    if (!canPublish) {
      return {
        disabled: true,
        label: 'Cannot Publish',
        className: 'bg-gray-300 text-gray-500 cursor-not-allowed',
      };
    }

    return {
      disabled: false,
      label: 'Publish to Main',
      className: 'bg-purple-600 text-white hover:bg-purple-700',
    };
  };

  const buttonState = getButtonState();

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={buttonState.disabled}
        className={`rounded-md px-4 py-2 text-sm font-medium ${buttonState.className}`}
      >
        {buttonState.label}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Publish Branch
            </h2>
            <p className="mt-2 text-gray-600">
              You are about to publish <strong>{branchName}</strong> to main.
              This action will merge all changes and make them live.
            </p>

            <div className="mt-4 rounded-md bg-yellow-50 p-3">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    This action cannot be undone. Make sure all changes have
                    been reviewed and approved.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPublishing}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isPublishing ? 'Publishing...' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PublishButton;
