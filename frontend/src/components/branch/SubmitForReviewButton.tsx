import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, Button, TextArea, Text, Callout, Flex, Avatar, Badge } from '@radix-ui/themes';
import { branchService } from '../../services/branchService';
import { api } from '../../services/api';
import { invalidateWorkflowQueries } from '../../hooks/queryKeys';
import type { TeamMember } from './TeamMemberPicker';

interface SubmitForReviewButtonProps {
  branchId: string;
  /** Disabled due to missing content (passed from parent based on canSubmitForReview) */
  disabled?: boolean;
  onSuccess?: () => void;
}

export function SubmitForReviewButton({
  branchId,
  disabled = false,
  onSuccess,
}: SubmitForReviewButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch current reviewers
  const { data: reviewers = [] } = useQuery<TeamMember[]>({
    queryKey: ['branch-reviewers', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/reviewers`),
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      const reviewerIds = reviewers.map((r) => r.id);
      return branchService.submitForReview(branchId, reviewerIds, reason || undefined);
    },
    onSuccess: () => {
      invalidateWorkflowQueries(queryClient, branchId);
      setShowModal(false);
      setReason('');
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Failed to submit for review:', error);
      // Error notification would be handled by the mutation hook
    },
  });

  const handleSubmit = useCallback(() => {
    if (reviewers.length === 0) {
      alert('Please assign at least one reviewer before submitting for review.');
      return;
    }
    setShowModal(true);
  }, [reviewers.length]);

  const handleConfirmSubmit = useCallback(() => {
    submitMutation.mutate();
  }, [submitMutation]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setReason('');
  }, []);

  const hasReviewers = reviewers.length > 0;
  const isDisabled = disabled || !hasReviewers;

  const getTooltip = () => {
    if (disabled) {
      return 'Add content to this branch before submitting for review';
    }
    if (!hasReviewers) {
      return 'Please assign at least one reviewer before submitting';
    }
    return 'Submit this branch for review';
  };

  return (
    <Dialog.Root open={showModal} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Trigger>
        <Button
          onClick={handleSubmit}
          disabled={isDisabled}
          title={getTooltip()}
        >
          Submit for Review
          {hasReviewers && (
            <Badge color="blue" size="1" ml="2">
              {reviewers.length}
            </Badge>
          )}
        </Button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Submit for Review</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          This branch will be submitted for review to{' '}
          {reviewers.length === 1 ? (
            <Text weight="bold">{reviewers[0].displayName}</Text>
          ) : (
            <Text weight="bold">
              {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
            </Text>
          )}
          .
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          {/* Reviewers List */}
          <div className="rounded-lg bg-[var(--gray-3)] p-3">
            <Text size="1" weight="medium">Assigned Reviewers:</Text>
            <Flex direction="column" gap="2" mt="2">
              {reviewers.map((reviewer) => (
                <Flex key={reviewer.id} align="center" gap="2">
                  <Avatar
                    src={reviewer.avatarUrl}
                    fallback={reviewer.displayName.charAt(0).toUpperCase()}
                    size="1"
                  />
                  <Text size="2">{reviewer.displayName}</Text>
                  <Text size="1" color="gray">({reviewer.email})</Text>
                </Flex>
              ))}
            </Flex>
          </div>

          {/* Optional Reason */}
          <div>
            <Text as="label" size="2" weight="medium" className="block mb-1">
              Message (optional)
            </Text>
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a message for the reviewers..."
              rows={3}
            />
          </div>

          {/* Error Display */}
          {submitMutation.isError && (
            <Callout.Root color="red">
              <Callout.Text>
                {(submitMutation.error as any)?.message || 'Failed to submit for review'}
              </Callout.Text>
            </Callout.Root>
          )}
        </Flex>

        {/* Actions */}
        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="outline" disabled={submitMutation.isPending}>
              Cancel
            </Button>
          </Dialog.Close>
          <Button onClick={handleConfirmSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default SubmitForReviewButton;
