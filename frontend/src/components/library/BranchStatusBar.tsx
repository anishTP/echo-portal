import { useEffect, useRef } from 'react';
import { Button, Text } from '@radix-ui/themes';
import { animate as animateEl } from 'animejs';
import { CommitIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { useSearchParams } from 'react-router-dom';
import { LifecycleStatus } from '../branch/LifecycleStatus';
import { SubmitForReviewButton } from '../branch/SubmitForReviewButton';
import type { BranchStateType } from '@echo-portal/shared';
import styles from './BranchStatusBar.module.css';

export interface BranchStatusBarProps {
  branchName: string;
  branchState: string;
  branchId: string;
  isOwner: boolean;
  canSubmitForReview: boolean;
}

/**
 * Header banner displayed when browsing a branch (not editing, not reviewing).
 * Shows branch info and a "Submit for Review" button for draft branches.
 */
export function BranchStatusBar({
  branchName,
  branchState,
  branchId,
  isOwner,
  canSubmitForReview,
}: BranchStatusBarProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePreviewChanges = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', 'review');
    newParams.set('branchId', branchId);
    setSearchParams(newParams);
  };

  // Slide-down entrance animation on mount
  useEffect(() => {
    if (headerRef.current) {
      animateEl(headerRef.current, {
        translateY: ['-100%', '0%'],
        duration: 300,
        ease: 'out(3)',
      });
    }
  }, []);

  return (
    <div ref={headerRef} className={styles.header}>
      <div className={styles.content}>
        <div className={styles.info}>
          <div className={styles.branchBadge}>
            <CommitIcon width={14} height={14} />
            <Text size="2" weight="medium">
              {branchName}
            </Text>
          </div>
          <LifecycleStatus state={branchState as BranchStateType} size="sm" />
        </div>

        <div className={styles.actions}>
          {branchState === 'draft' && isOwner && canSubmitForReview && (
            <SubmitForReviewButton
              branchId={branchId}
              inlineReviewerSelection={true}
            />
          )}
          {branchState !== 'draft' && (
            <Button variant="soft" size="2" onClick={handlePreviewChanges}>
              <EyeOpenIcon />
              Preview Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BranchStatusBar;
