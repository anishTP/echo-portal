import { useState } from 'react';

interface RequestChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Dialog for requesting changes on a review
 * Requires a reason to be provided
 */
export function RequestChangesDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: RequestChangesDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) return;

    await onSubmit(reason.trim());
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative rounded-lg max-w-lg w-full mx-4 p-6"
        style={{ background: 'var(--color-background)', boxShadow: 'var(--shadow-5)', border: '1px solid var(--gray-6)' }}
      >
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--gray-12)' }}>Request Changes</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gray-11)' }}>
          Please explain what changes are needed. The branch will return to draft
          status and the contributor will be notified.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gray-12)' }}>
              Reason for changes *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the changes you'd like to see..."
              className="w-full px-3 py-2 rounded-md text-sm resize-none"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--gray-6)', color: 'var(--gray-12)' }}
              rows={4}
              required
              autoFocus
            />
            {!reason.trim() && (
              <p className="text-xs mt-1" style={{ color: 'var(--red-9)' }}>
                A reason is required when requesting changes
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm"
              style={{ color: 'var(--gray-11)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isSubmitting}
              className="px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--orange-9)' }}
            >
              {isSubmitting ? 'Submitting...' : 'Request Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestChangesDialog;
