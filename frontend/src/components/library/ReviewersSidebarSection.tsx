import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Dialog, Flex, Text } from '@radix-ui/themes';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { api } from '../../services/api';
import { TeamMemberPicker, type TeamMember } from '../branch/TeamMemberPicker';
import type { ReviewResponse } from '../../services/reviewService';
import { reviewKeys } from '../../hooks/queryKeys';
import sidebarStyles from './ContentMetadataSidebar.module.css';
import styles from './ReviewersSidebarSection.module.css';

interface ReviewersSidebarSectionProps {
  branchId: string;
  reviews: ReviewResponse[];
  isOwner: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusBadge(review: ReviewResponse) {
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

export function ReviewersSidebarSection({
  branchId,
  reviews,
  isOwner,
}: ReviewersSidebarSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Invalidate branch reviews when reviewers are added/removed
  const handleReviewersChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: reviewKeys.branchReviews(branchId) });
  }, [queryClient, branchId]);

  // Fetch reviewer details (shares cache with TeamMemberPicker)
  const { data: reviewerDetails = [] } = useQuery<TeamMember[]>({
    queryKey: ['branch-reviewers', branchId],
    queryFn: () => api.get<TeamMember[]>(`/branches/${branchId}/reviewers`),
  });

  // Only show active (non-cancelled) reviews
  const activeReviews = reviews.filter((r) => r.status !== 'cancelled');

  if (activeReviews.length === 0) {
    return null;
  }

  return (
    <div className={sidebarStyles.section}>
      <div className={styles.titleRow}>
        <h3 className={sidebarStyles.sectionTitle} style={{ marginBottom: 0 }}>
          Reviewers
        </h3>
        {isOwner && (
          <button
            className={styles.editButton}
            onClick={() => setDialogOpen(true)}
            title="Edit reviewers"
          >
            <Pencil1Icon width={14} height={14} />
          </button>
        )}
      </div>

      {activeReviews.map((review) => {
        const details = reviewerDetails.find((r) => r.id === review.reviewerId);
        const name = details?.displayName || review.reviewerId.slice(0, 8);

        return (
          <div key={review.id} className={styles.reviewerRow}>
            <div className={styles.reviewerInfo}>
              <div className={styles.avatar}>
                {details?.avatarUrl ? (
                  <img src={details.avatarUrl} alt={name} />
                ) : (
                  getInitials(name)
                )}
              </div>
              <span className={styles.reviewerName}>{name}</span>
            </div>
            {getStatusBadge(review)}
          </div>
        );
      })}

      {isOwner && (
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Content maxWidth="480px">
            <Dialog.Title>
              <Flex align="center" gap="2">
                <Text>Manage Reviewers</Text>
              </Flex>
            </Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="4">
              Add or remove reviewers for this branch.
            </Dialog.Description>
            <TeamMemberPicker branchId={branchId} onReviewersChange={handleReviewersChange} />
            <Flex justify="end" mt="4">
              <Dialog.Close>
                <button className={styles.doneButton}>Done</button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </div>
  );
}

export default ReviewersSidebarSection;
