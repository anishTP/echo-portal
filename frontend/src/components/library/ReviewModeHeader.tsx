import { useState } from 'react';
import { Button, Text, Badge, SegmentedControl, Dialog, Callout, Flex } from '@radix-ui/themes';
import { Cross2Icon, CommitIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { DiffStats } from '@echo-portal/shared';
import type { ReviewResponse } from '../../services/reviewService';
import { ReviewDecisionPanel } from '../review/ReviewDecisionPanel';
import styles from './ReviewModeHeader.module.css';

export interface ReviewModeHeaderProps {
  branchName: string;
  onClose: () => void;
  stats: DiffStats | null;
  displayMode: 'unified' | 'split';
  onDisplayModeChange: (mode: 'unified' | 'split') => void;
  reviews: ReviewResponse[];
  activeReview: ReviewResponse | null;
  currentUserId: string;
  onApprove: (reason?: string) => Promise<void>;
  onRequestChanges: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
  /** When true, user is viewing feedback from a completed review (read-only) */
  feedbackMode?: boolean;
  /** Branch workflow state */
  branchState?: string;
  /** Whether the current user can publish this branch */
  canPublish?: boolean;
  /** Callback to publish the branch */
  onPublish?: () => Promise<void>;
  /** Whether a publish operation is in progress */
  isPublishing?: boolean;
}

export function ReviewModeHeader({
  branchName,
  onClose,
  stats,
  displayMode,
  onDisplayModeChange,
  activeReview,
  currentUserId,
  onApprove,
  onRequestChanges,
  isSubmitting = false,
  feedbackMode = false,
  branchState,
  canPublish = false,
  onPublish,
  isPublishing = false,
}: ReviewModeHeaderProps) {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const isApproved = branchState === 'approved';

  const handleConfirmPublish = async () => {
    setPublishError(null);
    try {
      await onPublish?.();
      setShowPublishDialog(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish');
    }
  };

  const badgeColor = isApproved ? 'green' : feedbackMode ? 'orange' : 'amber';
  const badgeLabel = isApproved ? 'Approved' : feedbackMode ? 'Changes Requested' : 'Pending Review';

  return (
    <div className={styles.header}>
      <div className={styles.content}>
        <div className={styles.left}>
          <Button
            variant="ghost"
            size="1"
            onClick={onClose}
            className={styles.closeButton}
          >
            <Cross2Icon />
          </Button>

          <div className={styles.branchBadge}>
            <CommitIcon width={14} height={14} />
            <Text size="2" weight="medium">
              {branchName}
            </Text>
          </div>

          <Badge color={badgeColor} variant="soft" size="1">
            {badgeLabel}
          </Badge>

          {stats && (
            <Text size="1" color="gray" className={styles.statsText}>
              <span className={styles.addition}>+{stats.additions}</span>
              {' / '}
              <span className={styles.deletion}>-{stats.deletions}</span>
              {', '}
              {stats.filesChanged} item{stats.filesChanged !== 1 ? 's' : ''} changed
            </Text>
          )}
        </div>

        <div className={styles.right}>
          <SegmentedControl.Root
            size="1"
            value={displayMode}
            onValueChange={(v) => onDisplayModeChange(v as 'unified' | 'split')}
          >
            <SegmentedControl.Item value="unified">Unified</SegmentedControl.Item>
            <SegmentedControl.Item value="split">Split</SegmentedControl.Item>
          </SegmentedControl.Root>

          {activeReview && !feedbackMode && (
            <div className={styles.decisionButtons}>
              <ReviewDecisionPanel
                review={activeReview}
                currentUserId={currentUserId}
                onApprove={onApprove}
                onRequestChanges={onRequestChanges}
                isSubmitting={isSubmitting}
              />
            </div>
          )}

          {isApproved && canPublish && !feedbackMode && (
            <Dialog.Root open={showPublishDialog} onOpenChange={setShowPublishDialog}>
              <Dialog.Trigger>
                <Button color="green" disabled={isPublishing}>
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </Button>
              </Dialog.Trigger>

              <Dialog.Content maxWidth="450px">
                <Dialog.Title>Publish Branch</Dialog.Title>
                <Dialog.Description size="2" color="gray">
                  You are about to publish <Text weight="bold">{branchName}</Text> to main.
                  This action will merge all changes and make them live.
                </Dialog.Description>

                <Flex direction="column" gap="4" mt="4">
                  <Callout.Root color="yellow">
                    <Callout.Icon>
                      <ExclamationTriangleIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      This action cannot be undone. Make sure all changes have
                      been reviewed and approved.
                    </Callout.Text>
                  </Callout.Root>

                  {publishError && (
                    <Callout.Root color="red">
                      <Callout.Text>{publishError}</Callout.Text>
                    </Callout.Root>
                  )}
                </Flex>

                <Flex gap="3" mt="5" justify="end">
                  <Dialog.Close>
                    <Button variant="outline" disabled={isPublishing}>
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button color="green" onClick={handleConfirmPublish} disabled={isPublishing}>
                    {isPublishing ? 'Publishing...' : 'Confirm Publish'}
                  </Button>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewModeHeader;
