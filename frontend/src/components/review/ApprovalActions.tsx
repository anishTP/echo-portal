import { useState } from 'react';
import { Button, TextArea, Callout } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

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
        <label className="block text-sm font-medium text-[var(--gray-12)]">
          {mode === 'approve' ? 'Approval comment (optional)' : 'Reason for requesting changes'}
          {mode === 'changes' && <span className="text-[var(--red-9)]"> *</span>}
        </label>
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            mode === 'approve'
              ? 'Add an optional comment with your approval...'
              : 'Describe what changes are needed...'
          }
          rows={3}
          style={{ marginTop: '4px' }}
        />
      </div>

      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
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
