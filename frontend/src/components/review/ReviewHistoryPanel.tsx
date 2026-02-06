import { Flex, Text, Badge } from '@radix-ui/themes';
import type { ReviewCycleSummary, CycleOutcome } from '@echo-portal/shared';
import styles from './ReviewHistoryPanel.module.css';

interface ReviewHistoryPanelProps {
  cycles: ReviewCycleSummary[];
  currentCycle: number;
}

const outcomeLabel: Record<CycleOutcome, string> = {
  pending: 'In Progress',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  withdrawn: 'Withdrawn',
};

const outcomeColor: Record<CycleOutcome, 'blue' | 'green' | 'orange' | 'gray'> = {
  pending: 'blue',
  approved: 'green',
  changes_requested: 'orange',
  withdrawn: 'gray',
};

export function ReviewHistoryPanel({
  cycles,
  currentCycle,
}: ReviewHistoryPanelProps) {
  if (cycles.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Text size="2" color="gray">
          No review cycles yet. Submit this branch for review to begin.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Text size="3" weight="bold">
        Review History
      </Text>

      {cycles
        .slice()
        .reverse()
        .map((cycle) => {
          const isCurrent = cycle.cycleNumber === currentCycle;
          const approvalPercent =
            cycle.requiredApprovals > 0
              ? Math.min(
                  100,
                  Math.round(
                    (cycle.approvalCount / cycle.requiredApprovals) * 100
                  )
                )
              : 0;

          return (
            <div
              key={cycle.cycleNumber}
              className={styles.cycleCard}
              data-outcome={cycle.outcome}
              data-current={isCurrent || undefined}
            >
              <Flex direction="column" gap="3">
                {/* Cycle header */}
                <Flex justify="between" align="center">
                  <Flex align="center" gap="2">
                    <span className={styles.cycleNumber}>
                      {cycle.cycleNumber}
                    </span>
                    <Text size="2" weight="medium">
                      Cycle {cycle.cycleNumber}
                      {isCurrent && (
                        <Text size="1" color="gray" ml="1">
                          (current)
                        </Text>
                      )}
                    </Text>
                  </Flex>
                  <Badge
                    size="1"
                    variant="soft"
                    color={outcomeColor[cycle.outcome]}
                  >
                    {outcomeLabel[cycle.outcome]}
                  </Badge>
                </Flex>

                {/* Submitted date */}
                <Text size="1" color="gray">
                  Submitted{' '}
                  {new Date(cycle.submittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>

                {/* Approval progress */}
                <Flex direction="column" gap="1">
                  <Flex justify="between" align="center">
                    <Text size="1" color="gray">
                      Approvals
                    </Text>
                    <Text size="1" weight="medium">
                      {cycle.approvalCount} / {cycle.requiredApprovals}
                    </Text>
                  </Flex>
                  <div className={styles.approvalBar}>
                    <div
                      className={styles.approvalFill}
                      style={{ width: `${approvalPercent}%` }}
                    />
                  </div>
                </Flex>

                {/* Reviewer count */}
                <Text size="1" color="gray">
                  {cycle.reviewerCount} reviewer{cycle.reviewerCount !== 1 ? 's' : ''} assigned
                </Text>
              </Flex>
            </div>
          );
        })}
    </div>
  );
}

export default ReviewHistoryPanel;
