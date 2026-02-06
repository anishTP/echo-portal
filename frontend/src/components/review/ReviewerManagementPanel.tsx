import { useState } from 'react';
import { Flex, Text, Badge, Button, Select } from '@radix-ui/themes';
import type { ReviewResponse } from '../../services/reviewService';
import styles from './ReviewerManagementPanel.module.css';

interface Reviewer {
  id: string;
  displayName: string;
}

interface ReviewerManagementPanelProps {
  reviews: ReviewResponse[];
  currentUserId: string;
  branchOwnerId: string;
  availableReviewers: Reviewer[];
  onAddReviewer: (reviewId: string, reviewerId: string) => Promise<void>;
  onRemoveReviewer: (reviewId: string, reviewerId: string) => Promise<void>;
  isSubmitting?: boolean;
}

function getDecisionBadge(review: ReviewResponse) {
  if (review.status === 'completed' && review.decision === 'approved') {
    return (
      <Badge size="1" variant="soft" color="green">
        Approved
      </Badge>
    );
  }
  if (review.status === 'completed' && review.decision === 'changes_requested') {
    return (
      <Badge size="1" variant="soft" color="orange">
        Changes Requested
      </Badge>
    );
  }
  if (review.status === 'in_progress') {
    return (
      <Badge size="1" variant="soft" color="blue">
        Reviewing
      </Badge>
    );
  }
  if (review.status === 'pending') {
    return (
      <Badge size="1" variant="soft" color="gray">
        Pending
      </Badge>
    );
  }
  return null;
}

export function ReviewerManagementPanel({
  reviews,
  currentUserId,
  branchOwnerId,
  availableReviewers,
  onAddReviewer,
  onRemoveReviewer,
  isSubmitting = false,
}: ReviewerManagementPanelProps) {
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const isOwner = currentUserId === branchOwnerId;

  // Active reviews (not cancelled)
  const activeReviews = reviews.filter((r) => r.status !== 'cancelled');

  // Reviewers already assigned
  const assignedReviewerIds = new Set(activeReviews.map((r) => r.reviewerId));

  // Available reviewers not already assigned and not the branch owner
  const unassignedReviewers = availableReviewers.filter(
    (r) => !assignedReviewerIds.has(r.id) && r.id !== branchOwnerId
  );

  // Find a review ID to use for adding (any active review on this branch)
  const referenceReviewId = activeReviews[0]?.id;

  const handleAdd = async () => {
    if (!selectedReviewer || !referenceReviewId) return;
    await onAddReviewer(referenceReviewId, selectedReviewer);
    setSelectedReviewer('');
  };

  const getReviewerName = (reviewerId: string) => {
    const reviewer = availableReviewers.find((r) => r.id === reviewerId);
    return reviewer?.displayName || reviewerId.slice(0, 8);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={styles.root}>
      <Text size="2" weight="bold" mb="3">
        Reviewers
      </Text>

      {/* Reviewer list */}
      <Flex direction="column" gap="1">
        {activeReviews.map((review) => {
          const name = getReviewerName(review.reviewerId);
          const canRemove =
            isOwner &&
            review.status !== 'completed';

          return (
            <div key={review.id} className={styles.reviewerRow}>
              <Flex align="center" gap="2">
                <span className={styles.reviewerAvatar}>
                  {getInitials(name)}
                </span>
                <Flex direction="column">
                  <Text size="2" weight="medium">
                    {name}
                  </Text>
                </Flex>
              </Flex>

              <Flex align="center" gap="2">
                {getDecisionBadge(review)}
                {canRemove && (
                  <button
                    className={styles.removeButton}
                    onClick={() => onRemoveReviewer(review.id, review.reviewerId)}
                    disabled={isSubmitting}
                    title="Remove reviewer"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </Flex>
            </div>
          );
        })}
      </Flex>

      {/* Add reviewer */}
      {isOwner && unassignedReviewers.length > 0 && referenceReviewId && (
        <div className={styles.addSection}>
          <div className={styles.selectWrapper}>
            <Select.Root
              value={selectedReviewer}
              onValueChange={setSelectedReviewer}
              size="2"
            >
              <Select.Trigger
                placeholder="Add a reviewer..."
                style={{ flex: 1 }}
              />
              <Select.Content>
                {unassignedReviewers.map((r) => (
                  <Select.Item key={r.id} value={r.id}>
                    {r.displayName}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Button
              size="2"
              variant="soft"
              onClick={handleAdd}
              disabled={!selectedReviewer || isSubmitting}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {activeReviews.length === 0 && (
        <Text size="2" color="gray" mt="2">
          No reviewers assigned yet.
        </Text>
      )}
    </div>
  );
}

export default ReviewerManagementPanel;
