import { useState } from 'react';

interface ApprovalActionsProps {
  onApprove: (reason?: string) => Promise<void>;
  onRequestChanges: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ApprovalActions({
  onApprove,
  onRequestChanges,
  isSubmitting = false,
}: ApprovalActionsProps) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'changes'>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setError(null);
    try {
      await onApprove(reason || undefined);
      setMode('idle');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleRequestChanges = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting changes');
      return;
    }

    setError(null);
    try {
      await onRequestChanges(reason);
      setMode('idle');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request changes');
    }
  };

  const handleCancel = () => {
    setMode('idle');
    setReason('');
    setError(null);
  };

  if (mode === 'idle') {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => setMode('approve')}
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => setMode('changes')}
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Request Changes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {mode === 'approve' ? 'Approval comment (optional)' : 'Reason for requesting changes'}
          {mode === 'changes' && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            mode === 'approve'
              ? 'Add an optional comment with your approval...'
              : 'Describe what changes are needed...'
          }
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={mode === 'approve' ? handleApprove : handleRequestChanges}
          disabled={isSubmitting}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
            mode === 'approve'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {isSubmitting
            ? 'Submitting...'
            : mode === 'approve'
              ? 'Confirm Approval'
              : 'Submit Changes Request'}
        </button>
      </div>
    </div>
  );
}

export default ApprovalActions;
