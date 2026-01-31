import Dexie, { type Table } from 'dexie';

/**
 * Draft stored in IndexedDB for offline-first auto-save.
 */
export interface Draft {
  /** Composite key: `${contentId}:${branchId}` */
  id: string;
  contentId: string;
  branchId: string;
  title: string;
  body: string;
  metadata: {
    category?: string;
    tags?: string[];
    description?: string;
  };
  /** Incremented on each local save */
  localVersion: number;
  /** Last synced server version timestamp, null for new content */
  serverVersionTimestamp: string | null;
  /** First local save timestamp */
  createdAt: number;
  /** Last local save timestamp */
  updatedAt: number;
  /** false = pending server sync */
  synced: boolean;
}

/**
 * Tracks active editing sessions for crash recovery and multi-tab detection.
 */
export interface EditSession {
  /** Session UUID */
  id: string;
  contentId: string;
  branchId: string;
  userId: string;
  /** Session start timestamp */
  startedAt: number;
  /** Last keystroke/action timestamp */
  lastActivityAt: number;
  /** Browser fingerprint for multi-device detection */
  deviceId: string;
}

/**
 * Queued sync operation for retry with exponential backoff.
 */
export interface SyncQueueItem {
  /** Auto-increment ID */
  id?: number;
  /** Reference to drafts.id */
  draftId: string;
  operation: 'sync' | 'delete';
  /** Retry count */
  attempts: number;
  /** Max retry limit */
  maxAttempts: number;
  /** Scheduled retry timestamp */
  nextRetryAt: number;
  /** Last error message */
  lastError?: string;
  /** Queue entry timestamp */
  createdAt: number;
}

/**
 * Dexie database for offline draft storage.
 */
export class DraftDatabase extends Dexie {
  drafts!: Table<Draft, string>;
  editSessions!: Table<EditSession, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('EchoPortalDrafts');

    this.version(1).stores({
      drafts: 'id, contentId, branchId, updatedAt, synced',
      editSessions: 'id, [contentId+branchId], lastActivityAt',
      syncQueue: '++id, draftId, nextRetryAt, createdAt',
    });
  }
}

/** Singleton database instance */
export const draftDb = new DraftDatabase();

/**
 * Create a composite draft ID from content and branch IDs.
 */
export function createDraftId(contentId: string, branchId: string): string {
  return `${contentId}:${branchId}`;
}

/**
 * Parse a composite draft ID back to content and branch IDs.
 */
export function parseDraftId(draftId: string): { contentId: string; branchId: string } {
  const [contentId, branchId] = draftId.split(':');
  return { contentId, branchId };
}
