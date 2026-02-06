import { Button, Text, Badge, SegmentedControl } from '@radix-ui/themes';
import { Cross2Icon, CommitIcon } from '@radix-ui/react-icons';
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
}: ReviewModeHeaderProps) {
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

          <Badge color={feedbackMode ? 'orange' : 'amber'} variant="soft" size="1">
            {feedbackMode ? 'Changes Requested' : 'Pending Review'}
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
        </div>
      </div>
    </div>
  );
}

export default ReviewModeHeader;
