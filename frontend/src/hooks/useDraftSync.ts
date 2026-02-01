import { useCallback, useEffect, useRef, useState } from 'react';
import { contentApi } from '../services/content-api';
import { draftDb, createDraftId } from '../services/draft-db';
import { useOnlineStatus, subscribeToOnlineStatus } from './useOnlineStatus';
import type { DraftSyncInput, DraftSyncResult } from '@echo-portal/shared';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'queued' | 'error';

export interface SyncConflict {
  serverVersionTimestamp: string;
  serverBody: string;
  serverAuthor: {
    id: string;
    username: string;
  };
  clientBody: string;
}

export interface DraftSyncOptions {
  /** Content UUID */
  contentId: string;
  /** Branch UUID */
  branchId: string;
  /** Max retry attempts (default: 5) */
  maxRetries?: number;
  /** Base retry delay in ms (default: 60000 - 1 minute) */
  baseRetryDelay?: number;
  /** Callback when sync succeeds */
  onSync?: (result: DraftSyncResult) => void;
  /** Callback when conflict detected */
  onConflict?: (conflict: SyncConflict) => void;
  /** Callback when sync fails */
  onError?: (error: Error) => void;
}

export interface DraftSyncState {
  status: SyncStatus;
  error: string | null;
  conflict: SyncConflict | null;
  queuedItems: number;
  lastSyncAt: number | null;
}

export interface UseDraftSyncReturn {
  state: DraftSyncState;
  /** Sync draft to server */
  sync: (changeDescription?: string) => Promise<DraftSyncResult | null>;
  /** Retry failed syncs in queue */
  retryQueue: () => Promise<void>;
  /** Clear conflict state (user resolved it) */
  clearConflict: () => void;
  /** Get pending queue items count */
  getQueueCount: () => Promise<number>;
  /** Check if there are unsynced changes in the draft */
  hasUnsyncedChanges: () => Promise<boolean>;
  /** Clear all queue items for this draft */
  clearQueue: () => Promise<void>;
}

/**
 * Hook for syncing drafts to the server with conflict detection and retry queue.
 */
export function useDraftSync(options: DraftSyncOptions): UseDraftSyncReturn {
  const {
    contentId,
    branchId,
    maxRetries = 5,
    baseRetryDelay = 60000,
    onSync,
    onConflict,
    onError,
  } = options;

  const draftId = createDraftId(contentId, branchId);
  const { isOnline } = useOnlineStatus();
  const syncInProgress = useRef(false);

  const [state, setState] = useState<DraftSyncState>({
    status: 'idle',
    error: null,
    conflict: null,
    queuedItems: 0,
    lastSyncAt: null,
  });

  // Add to retry queue
  const addToQueue = useCallback(async (error: string) => {
    const existing = await draftDb.syncQueue
      .where('draftId')
      .equals(draftId)
      .first();

    if (existing) {
      // Update existing queue item
      const newAttempts = existing.attempts + 1;
      if (newAttempts <= existing.maxAttempts) {
        const delay = baseRetryDelay * Math.pow(2, newAttempts - 1);
        await draftDb.syncQueue.update(existing.id!, {
          attempts: newAttempts,
          nextRetryAt: Date.now() + delay,
          lastError: error,
        });
      }
    } else {
      // Add new queue item
      await draftDb.syncQueue.add({
        draftId,
        operation: 'sync',
        attempts: 1,
        maxAttempts: maxRetries,
        nextRetryAt: Date.now() + baseRetryDelay,
        lastError: error,
        createdAt: Date.now(),
      });
    }

    const count = await draftDb.syncQueue.count();
    setState(prev => ({ ...prev, status: 'queued', queuedItems: count }));
  }, [draftId, maxRetries, baseRetryDelay]);

  // Remove from queue after successful sync
  const removeFromQueue = useCallback(async () => {
    await draftDb.syncQueue.where('draftId').equals(draftId).delete();
    const count = await draftDb.syncQueue.count();
    setState(prev => ({ ...prev, queuedItems: count }));
  }, [draftId]);

  // Core sync function
  const sync = useCallback(async (changeDescription = 'Auto-saved changes'): Promise<DraftSyncResult | null> => {
    if (syncInProgress.current) {
      return null;
    }

    // Don't sync if no valid contentId
    if (!contentId) {
      return null;
    }

    if (!isOnline) {
      setState(prev => ({ ...prev, status: 'queued', error: 'Offline - changes queued' }));
      return null;
    }

    syncInProgress.current = true;
    setState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const draft = await draftDb.drafts.get(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      if (draft.synced) {
        setState(prev => ({ ...prev, status: 'synced' }));
        syncInProgress.current = false;
        return { success: true, newVersionTimestamp: draft.serverVersionTimestamp ?? undefined };
      }

      const input: DraftSyncInput = {
        branchId,
        title: draft.title,
        body: draft.body,
        metadata: draft.metadata,
        expectedServerVersion: draft.serverVersionTimestamp,
        changeDescription,
      };

      // Check content size before syncing (50 MB limit)
      const MAX_BODY_SIZE = 52_428_800;
      if (draft.body.length > MAX_BODY_SIZE) {
        const sizeMB = (draft.body.length / (1024 * 1024)).toFixed(1);
        throw new Error(`Content too large (${sizeMB} MB). Maximum size is 50 MB. Try removing some images.`);
      }

      const result = await contentApi.syncDraft(contentId, input);

      if (result.success && result.newVersionTimestamp) {
        // Update draft as synced
        await draftDb.drafts.update(draftId, {
          synced: true,
          serverVersionTimestamp: result.newVersionTimestamp,
        });

        // Remove from retry queue if present
        await removeFromQueue();

        setState(prev => ({
          ...prev,
          status: 'synced',
          lastSyncAt: Date.now(),
          error: null,
          conflict: null,
        }));

        onSync?.(result);
      } else if (result.conflict) {
        // Handle conflict
        const conflict: SyncConflict = {
          serverVersionTimestamp: result.conflict.serverVersionTimestamp,
          serverBody: result.conflict.serverBody,
          serverAuthor: {
            id: result.conflict.serverVersionAuthor.id,
            username: result.conflict.serverVersionAuthor.username,
          },
          clientBody: draft.body,
        };

        setState(prev => ({
          ...prev,
          status: 'conflict',
          conflict,
          error: null,
        }));

        onConflict?.(conflict);
      }

      syncInProgress.current = false;
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sync failed');

      // Check if this is a 404 error (content doesn't exist)
      // Don't retry 404s - the content is gone, remove from queue and clear draft
      const is404 = (err as { status?: number }).status === 404 ||
        error.message.includes('404') ||
        error.message.includes('not found') ||
        error.message.includes('NOT_FOUND');

      if (is404) {
        // Remove from queue - no point retrying
        await removeFromQueue();
        // Clear the orphaned draft
        await draftDb.drafts.delete(draftId);

        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Content no longer exists',
        }));
      } else {
        // Queue for retry on other errors
        await addToQueue(error.message);

        setState(prev => ({
          ...prev,
          status: 'error',
          error: error.message,
        }));
      }

      onError?.(error);
      syncInProgress.current = false;
      return null;
    }
  }, [contentId, branchId, draftId, isOnline, onSync, onConflict, onError, addToQueue, removeFromQueue]);

  // Retry queued syncs
  const retryQueue = useCallback(async () => {
    if (!isOnline) return;

    const now = Date.now();
    const readyItems = await draftDb.syncQueue
      .where('nextRetryAt')
      .belowOrEqual(now)
      .toArray();

    for (const item of readyItems) {
      if (item.draftId === draftId) {
        await sync();
      }
    }
  }, [draftId, isOnline, sync]);

  // Clear conflict state
  const clearConflict = useCallback(() => {
    setState(prev => ({ ...prev, status: 'idle', conflict: null }));
  }, []);

  // Get queue count
  const getQueueCount = useCallback(async () => {
    return draftDb.syncQueue.count();
  }, []);

  // Check if there are unsynced changes
  const hasUnsyncedChanges = useCallback(async (): Promise<boolean> => {
    const draft = await draftDb.drafts.get(draftId);
    return draft ? !draft.synced : false;
  }, [draftId]);

  // Clear all queue items for this draft
  const clearQueue = useCallback(async () => {
    await draftDb.syncQueue.where('draftId').equals(draftId).delete();
    const count = await draftDb.syncQueue.count();
    setState(prev => ({ ...prev, queuedItems: count, status: 'idle', error: null }));
  }, [draftId]);

  // Subscribe to online status changes to trigger queue processing
  useEffect(() => {
    // Don't process queue if no valid contentId
    if (!contentId) return;

    const unsubscribe = subscribeToOnlineStatus((online) => {
      if (online) {
        retryQueue();
      }
    });

    return unsubscribe;
  }, [contentId, retryQueue]);

  // Clean up orphaned queue entries and load initial queue count
  useEffect(() => {
    // Don't process if no valid contentId
    if (!contentId) return;

    const cleanupAndLoadCount = async () => {
      // Clean up queue entries that reference non-existent drafts
      const queueItems = await draftDb.syncQueue.toArray();
      for (const item of queueItems) {
        const draft = await draftDb.drafts.get(item.draftId);
        if (!draft) {
          // Draft no longer exists, remove from queue
          await draftDb.syncQueue.delete(item.id!);
        }
      }

      const count = await draftDb.syncQueue.count();
      setState(prev => ({ ...prev, queuedItems: count }));
    };

    cleanupAndLoadCount();
  }, [contentId]);

  return {
    state,
    sync,
    retryQueue,
    clearConflict,
    getQueueCount,
    hasUnsyncedChanges,
    clearQueue,
  };
}
