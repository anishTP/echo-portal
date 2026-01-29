import { useState } from 'react';
import { Button } from '@radix-ui/themes';

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
        <Button
          color="green"
          size="2"
          onClick={() => setMode('approve')}
          disabled={isSubmitting}
          style={{ flex: 1 }}
        >
          Approve
        </Button>
        <Button
          color="orange"
          size="2"
          onClick={() => setMode('changes')}
          disabled={isSubmitting}
          style={{ flex: 1 }}
        >
          Request Changes
        </Button>
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
        <Button
          variant="outline"
          size="2"
          onClick={handleCancel}
          disabled={isSubmitting}
          style={{ flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          color={mode === 'approve' ? 'green' : 'orange'}
          size="2"
          onClick={mode === 'approve' ? handleApprove : handleRequestChanges}
          disabled={isSubmitting}
          style={{ flex: 1 }}
        >
          {isSubmitting
            ? 'Submitting...'
            : mode === 'approve'
              ? 'Confirm Approval'
              : 'Submit Changes Request'}
        </Button>
      </div>
    </div>
  );
}

export default ApprovalActions;
