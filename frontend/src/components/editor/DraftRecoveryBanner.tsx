import { Box, Flex, Text, Button, Callout } from '@radix-ui/themes';
import { InfoCircledIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { Draft } from '../../services/draft-db';

export interface DraftRecoveryBannerProps {
  /** Unsynced draft that was recovered */
  draft: Draft;
  /** Callback when user chooses to restore the draft */
  onRestore: () => void;
  /** Callback when user chooses to discard the draft */
  onDiscard: () => void;
  /** Whether restore is in progress */
  isRestoring?: boolean;
}

/**
 * Banner shown when unsynced drafts are detected on mount.
 * Allows user to restore or discard recovered work.
 */
export function DraftRecoveryBanner({
  draft,
  onRestore,
  onDiscard,
  isRestoring = false,
}: DraftRecoveryBannerProps) {
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <Callout.Root color="amber" size="2">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>
      <Callout.Text>
        <Flex direction="column" gap="2">
          <Box>
            <Text weight="medium">Unsaved changes recovered</Text>
            <Text size="2" color="gray" as="p">
              Found unsynced changes from {formatTimestamp(draft.updatedAt)} with{' '}
              {draft.localVersion} local edit{draft.localVersion > 1 ? 's' : ''}.
            </Text>
          </Box>

          <Flex gap="2">
            <Button
              size="1"
              variant="solid"
              color="amber"
              onClick={onRestore}
              disabled={isRestoring}
            >
              <CheckIcon />
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Button>
            <Button
              size="1"
              variant="soft"
              color="gray"
              onClick={onDiscard}
              disabled={isRestoring}
            >
              <Cross2Icon />
              Discard
            </Button>
          </Flex>
        </Flex>
      </Callout.Text>
    </Callout.Root>
  );
}

export interface MultipleDraftsRecoveryBannerProps {
  /** Count of unsynced drafts found */
  draftCount: number;
  /** Callback to view draft recovery dialog */
  onViewDrafts: () => void;
  /** Callback to dismiss */
  onDismiss: () => void;
}

/**
 * Banner shown when multiple unsynced drafts are detected.
 */
export function MultipleDraftsRecoveryBanner({
  draftCount,
  onViewDrafts,
  onDismiss,
}: MultipleDraftsRecoveryBannerProps) {
  return (
    <Callout.Root color="amber" size="2">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>
      <Callout.Text>
        <Flex direction="column" gap="2">
          <Box>
            <Text weight="medium">Recovered drafts found</Text>
            <Text size="2" color="gray" as="p">
              Found {draftCount} unsynced draft{draftCount > 1 ? 's' : ''} that may contain
              unsaved work.
            </Text>
          </Box>

          <Flex gap="2">
            <Button size="1" variant="solid" color="amber" onClick={onViewDrafts}>
              View Drafts
            </Button>
            <Button size="1" variant="soft" color="gray" onClick={onDismiss}>
              Dismiss
            </Button>
          </Flex>
        </Flex>
      </Callout.Text>
    </Callout.Root>
  );
}
