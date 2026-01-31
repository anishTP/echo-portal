import { Badge, Text, Spinner } from '@radix-ui/themes';
import {
  CheckIcon,
  Cross2Icon,
  UpdateIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@radix-ui/react-icons';
import type { SaveStatus } from '../../hooks/useAutoSave';
import type { SyncStatus } from '../../hooks/useDraftSync';

export interface EditorStatusBarProps {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Current sync status */
  syncStatus?: SyncStatus;
  /** Whether currently online */
  isOnline?: boolean;
  /** Branch name */
  branchName?: string;
  /** Draft version number */
  versionNumber?: number;
  /** Number of queued sync items */
  pendingSyncCount?: number;
  /** Last synced timestamp */
  lastSyncedAt?: Date | null;
  /** CSS class name */
  className?: string;
}

function SaveStatusIcon({ status, isOnline }: { status: SaveStatus; isOnline: boolean }) {
  if (!isOnline) {
    return <Cross2Icon />;
  }

  switch (status) {
    case 'saved':
      return <CheckIcon />;
    case 'saving':
      return <Spinner size="1" />;
    case 'dirty':
      return <UpdateIcon />;
    case 'error':
      return <ExclamationTriangleIcon />;
    default:
      return null;
  }
}

function getSaveStatusLabel(status: SaveStatus, isOnline: boolean): string {
  if (!isOnline) {
    return 'Offline';
  }

  switch (status) {
    case 'saved':
      return 'Saved';
    case 'saving':
      return 'Saving...';
    case 'dirty':
      return 'Unsaved changes';
    case 'error':
      return 'Save failed';
    case 'idle':
      return '';
    default:
      return '';
  }
}

function getSaveStatusClass(status: SaveStatus, isOnline: boolean): string {
  if (!isOnline) return 'offline';
  if (status === 'saved') return 'saved';
  if (status === 'saving') return 'saving';
  if (status === 'dirty' || status === 'error') return 'unsaved';
  return '';
}

function SyncStatusBadge({
  status,
  isOnline,
  pendingCount,
}: {
  status: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
}) {
  if (!isOnline) {
    return (
      <Badge variant="soft" color="gray" size="1">
        <Cross2Icon /> Offline
      </Badge>
    );
  }

  switch (status) {
    case 'synced':
      return (
        <Badge variant="soft" color="green" size="1">
          <CheckIcon /> Synced
        </Badge>
      );
    case 'syncing':
      return (
        <Badge variant="soft" color="amber" size="1">
          <Spinner size="1" /> Syncing...
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="soft" color="gray" size="1">
          <ClockIcon /> Queued ({pendingCount})
        </Badge>
      );
    case 'conflict':
      return (
        <Badge variant="soft" color="red" size="1">
          <ExclamationTriangleIcon /> Conflict
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="soft" color="red" size="1">
          <Cross2Icon /> Sync failed
        </Badge>
      );
    default:
      return null;
  }
}

/**
 * Status bar showing save state, sync status, and branch info.
 */
export function EditorStatusBar({
  saveStatus,
  syncStatus = 'idle',
  isOnline = true,
  branchName,
  versionNumber,
  pendingSyncCount = 0,
  lastSyncedAt,
  className = '',
}: EditorStatusBarProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const saveStatusClass = getSaveStatusClass(saveStatus, isOnline);
  const saveStatusLabel = getSaveStatusLabel(saveStatus, isOnline);

  return (
    <div className={`editor-status-bar ${className}`}>
      <div className="status-left">
        {saveStatusLabel && (
          <span className={`save-status ${saveStatusClass}`}>
            <SaveStatusIcon status={saveStatus} isOnline={isOnline} />
            <Text size="1">{saveStatusLabel}</Text>
          </span>
        )}

        {versionNumber !== undefined && (
          <Text size="1" color="gray">
            Draft v{versionNumber}
          </Text>
        )}
      </div>

      <div className="status-right">
        {lastSyncedAt && (
          <Text size="1" color="gray">
            Last synced {formatTime(lastSyncedAt)}
          </Text>
        )}

        <SyncStatusBadge
          status={syncStatus}
          isOnline={isOnline}
          pendingCount={pendingSyncCount}
        />

        {branchName && (
          <Badge variant="soft" size="1" radius="full">
            {branchName}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default EditorStatusBar;
