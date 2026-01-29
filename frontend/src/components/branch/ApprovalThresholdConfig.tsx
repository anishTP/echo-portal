import { useState, useEffect } from 'react';
import { Card, Button, Badge, TextField, Slider, Text, Callout, Heading } from '@radix-ui/themes';
import { branchService } from '../../services/branchService';
import type { BranchResponse } from '../../services/branchService';

interface ApprovalThresholdConfigProps {
  branch: BranchResponse;
  isAdmin: boolean;
  onUpdate?: (branch: BranchResponse) => void;
}

export function ApprovalThresholdConfig({
  branch,
  isAdmin,
  onUpdate,
}: ApprovalThresholdConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [threshold, setThreshold] = useState(branch.requiredApprovals || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update threshold when branch changes
  useEffect(() => {
    setThreshold(branch.requiredApprovals || 1);
  }, [branch.requiredApprovals]);

  const handleSave = async () => {
    if (threshold < 1 || threshold > 10) {
      setError('Approval threshold must be between 1 and 10');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updatedBranch = await branchService.setApprovalThreshold(branch.id, threshold);
      setIsEditing(false);
      onUpdate?.(updatedBranch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval threshold');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setThreshold(branch.requiredApprovals || 1);
    setIsEditing(false);
    setError(null);
  };

  if (!isAdmin) {
    // Non-admin view - just display the current threshold
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Heading as="h3" size="2">Approval Threshold</Heading>
            <Text as="p" size="2" color="gray" className="mt-1">
              This branch requires {branch.requiredApprovals || 1} approval
              {(branch.requiredApprovals || 1) !== 1 ? 's' : ''} to proceed
            </Text>
          </div>
          <Badge size="2" color="blue" radius="full">
            {branch.requiredApprovals || 1}
          </Badge>
        </div>
      </Card>
    );
  }

  // Admin view - editable
  if (!isEditing) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Heading as="h3" size="2">Approval Threshold</Heading>
            <Text as="p" size="2" color="gray" className="mt-1">
              Requires {branch.requiredApprovals || 1} approval
              {(branch.requiredApprovals || 1) !== 1 ? 's' : ''} to approve the branch
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Badge size="2" color="blue" radius="full">
              {branch.requiredApprovals || 1}
            </Badge>
            <Button size="2" onClick={() => setIsEditing(true)}>
              Configure
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Editing mode
  return (
    <Card style={{ backgroundColor: 'var(--accent-3)', borderColor: 'var(--accent-6)' }}>
      <Heading as="h3" size="2" className="mb-3">
        Configure Approval Threshold
      </Heading>

      <div className="space-y-4">
        <div>
          <Text as="label" htmlFor="threshold" size="2" weight="medium" className="block mb-2">
            Required Approvals
          </Text>
          <div className="flex items-center gap-4">
            <div style={{ width: '6rem' }}>
              <TextField.Root
                id="threshold"
                type="number"
                min={1}
                max={10}
                value={threshold.toString()}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 1)}
                disabled={isSubmitting}
                style={{ textAlign: 'center' }}
              />
            </div>
            <div className="flex-1">
              <Slider
                value={[threshold]}
                onValueChange={(values) => setThreshold(values[0])}
                min={1}
                max={10}
                step={1}
                disabled={isSubmitting}
              />
              <div className="flex justify-between mt-1">
                <Text size="1" color="gray">1</Text>
                <Text size="1" color="gray">5</Text>
                <Text size="1" color="gray">10</Text>
              </div>
            </div>
          </div>
          <Text as="p" size="1" color="gray" className="mt-2">
            The branch will require {threshold} approval{threshold !== 1 ? 's' : ''} from reviewers
            before it can be approved.
          </Text>
        </div>

        {error && (
          <Callout.Root color="red" size="1">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ApprovalThresholdConfig;
