import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, Button, TextArea, Text, Callout, Flex, Avatar, Badge } from '@radix-ui/themes';
import { branchService } from '../../services/branchService';
import { api } from '../../services/api';
import { invalidateWorkflowQueries } from '../../hooks/queryKeys';
import { TeamMemberPicker, type TeamMember } from './TeamMemberPicker';

interface SubmitForReviewButtonProps {
  branchId: string;
  /** Disabled due to missing edited content (passed from parent) */
  disabled?: boolean;
  /**
   * When true, allows reviewer selection inside the dialog (Library page flow).
   * When false (default), requires reviewers to be pre-assigned (Dashboard/Settings flow).
   */
  inlineReviewerSelection?: boolean;
  onSuccess?: () => void;
}

export function SubmitForReviewButton({
  branchId,
  disabled = false,
  inlineReviewerSelection = false,
  onSuccess,
}: SubmitForReviewButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch current reviewers
  const { data: reviewers = [], refetch: refetchReviewers } = useQuery<TeamMember[]>({
    queryKey: ['branch-reviewers', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/reviewers`),
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      const reviewerIds = reviewers.map((r) => r.id);
      console.log('[SubmitForReview] Submitting with:', { branchId, reviewerIds, reason });
      return branchService.submitForReview(branchId, reviewerIds, reason || undefined);
    },
    onSuccess: async (data) => {
      console.log('[SubmitForReview] Success:', data);
      await invalidateWorkflowQueries(queryClient, branchId);
      console.log('[SubmitForReview] Queries refetched');
      setShowModal(false);
      setReason('');
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('[SubmitForReview] Error:', error);
    },
  });

  const hasReviewers = reviewers.length > 0;

  // Button disabled logic depends on the flow mode
  const isButtonDisabled = inlineReviewerSelection
    ? disabled // Library flow: only check for edited content
    : disabled || !hasReviewers; // Dashboard flow: check both content and reviewers

  const handleButtonClick = useCallback(() => {
    if (inlineReviewerSelection) {
      // Library flow: always open dialog, reviewer selection happens inside
      setShowModal(true);
    } else {
      // Dashboard flow: require reviewers before opening
      if (reviewers.length === 0) {
        alert('Please assign at least one reviewer before submitting for review.');
        return;
      }
      setShowModal(true);
    }
  }, [inlineReviewerSelection, reviewers.length]);

  const handleConfirmSubmit = useCallback(() => {
    submitMutation.mutate();
  }, [submitMutation]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setReason('');
  }, []);

  // Callback when reviewers change (for inline selection mode)
  const handleReviewersChange = useCallback(() => {
    refetchReviewers();
  }, [refetchReviewers]);

  const getTooltip = () => {
    if (disabled) {
      return 'Edit content to enable submission';
    }
    if (!inlineReviewerSelection && !hasReviewers) {
      return 'Please assign at least one reviewer before submitting';
    }
    return 'Submit this branch for review';
  };

  // Dialog submit button is disabled if no reviewers (in either mode)
  const isDialogSubmitDisabled = submitMutation.isPending || !hasReviewers;

  return (
    <Dialog.Root open={showModal} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Trigger>
        <Button
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
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

      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Submit for Review</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {hasReviewers ? (
            <>
              This branch will be submitted for review to{' '}
              {reviewers.length === 1 ? (
                <Text weight="bold">{reviewers[0].displayName}</Text>
              ) : (
                <Text weight="bold">
                  {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
                </Text>
              )}
              .
            </>
          ) : (
            'Select at least one reviewer to submit this branch for review.'
          )}
        </Dialog.Description>

        <Flex direction="column" gap="4" mt="4">
          {/* Reviewer Selection/Display */}
          {inlineReviewerSelection ? (
            // Library flow: show full TeamMemberPicker for inline selection
            <TeamMemberPicker
              branchId={branchId}
              onReviewersChange={handleReviewersChange}
            />
          ) : (
            // Dashboard flow: show read-only reviewer list
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
          )}

          {/* Optional Message */}
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

          {/* Hint when no reviewers in inline mode */}
          {inlineReviewerSelection && !hasReviewers && (
            <Callout.Root color="blue">
              <Callout.Text>
                Search and add at least one reviewer above to enable submission.
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
          <Button
            onClick={handleConfirmSubmit}
            disabled={isDialogSubmitDisabled}
            title={!hasReviewers ? 'Add at least one reviewer to submit' : undefined}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default SubmitForReviewButton;
