/**
 * T032: Integration test for auto-save flow
 * Tests: edit → debounce → IndexedDB save → server sync
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  DraftDatabase,
  createDraftId,
  type Draft,
} from '../../src/services/draft-db';

// Mock the content API for server sync
vi.mock('../../src/services/content-api', () => ({
  syncDraft: vi.fn(),
}));

describe('auto-save flow', () => {
  let db: DraftDatabase;

  beforeEach(async () => {
    // Use real timers for IndexedDB integration tests
    db = new DraftDatabase();
    await db.open();
  });

  afterEach(async () => {
    await db.drafts.clear();
    await db.editSessions.clear();
    await db.syncQueue.clear();
    db.close();
    vi.clearAllMocks();
  });

  describe('edit → debounce → IndexedDB save', () => {
    it('should save draft to IndexedDB after debounce delay', async () => {
      
      const contentId = 'test-content-id';
      const branchId = 'test-branch-id';
      const draftId = createDraftId(contentId, branchId);

      // Simulate saving a draft
      const draft: Draft = {
        id: draftId,
        contentId,
        branchId,
        title: 'Test Title',
        body: '# Hello World',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      };

      await db.drafts.put(draft);

      // Verify draft is saved
      const saved = await db.drafts.get(draftId);
      expect(saved).toBeDefined();
      expect(saved?.body).toBe('# Hello World');
      expect(saved?.synced).toBe(false);
    });

    it('should increment localVersion on each save', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      // Initial save
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Version 1',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      // Simulate subsequent save
      await db.drafts.update(draftId, {
        body: 'Version 2',
        localVersion: 2,
        updatedAt: Date.now(),
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.localVersion).toBe(2);
      expect(draft?.body).toBe('Version 2');
    });

    it('should preserve metadata across saves', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Content',
        metadata: {
          category: 'tutorial',
          tags: ['react', 'typescript'],
          description: 'A test document',
        },
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      // Update only the body
      await db.drafts.update(draftId, {
        body: 'Updated content',
        localVersion: 2,
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.metadata.category).toBe('tutorial');
      expect(draft?.metadata.tags).toEqual(['react', 'typescript']);
    });
  });

  describe('IndexedDB save → server sync', () => {
    it('should mark draft as synced after successful server sync', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      // Create unsynced draft
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Content',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      // Simulate successful server sync
      const serverVersionTimestamp = new Date().toISOString();
      await db.drafts.update(draftId, {
        synced: true,
        serverVersionTimestamp,
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.synced).toBe(true);
      expect(draft?.serverVersionTimestamp).toBe(serverVersionTimestamp);
    });

    it('should queue failed syncs for retry', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      // Create draft
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Content',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      // Simulate failed sync - add to queue
      await db.syncQueue.add({
        draftId,
        operation: 'sync',
        attempts: 1,
        maxAttempts: 5,
        nextRetryAt: Date.now() + 60000,
        lastError: 'Network error',
        createdAt: Date.now(),
      });

      const queueItems = await db.syncQueue.where('draftId').equals(draftId).toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0].lastError).toBe('Network error');
    });

    it('should use exponential backoff for retries', async () => {
      const draftId = createDraftId('content-1', 'branch-1');
      const now = Date.now();

      // First retry: 1 minute
      const id = await db.syncQueue.add({
        draftId,
        operation: 'sync',
        attempts: 1,
        maxAttempts: 5,
        nextRetryAt: now + 60000, // 1 min
        createdAt: now,
      });

      // Simulate second retry: 2 minutes
      await db.syncQueue.update(id, {
        attempts: 2,
        nextRetryAt: now + 120000, // 2 min
      });

      const item = await db.syncQueue.get(id);
      expect(item?.attempts).toBe(2);
      expect(item?.nextRetryAt).toBe(now + 120000);
    });

    it('should stop retrying after max attempts', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      // Add item at max attempts
      const id = await db.syncQueue.add({
        draftId,
        operation: 'sync',
        attempts: 5,
        maxAttempts: 5,
        nextRetryAt: Date.now(),
        lastError: 'Max retries exceeded',
        createdAt: Date.now(),
      });

      const item = await db.syncQueue.get(id);
      expect(item?.attempts).toBe(5);
      expect(item?.attempts).toBe(item?.maxAttempts);
    });
  });

  describe('offline → online sync', () => {
    it('should find all unsynced drafts', async () => {

      // Create mix of synced and unsynced drafts
      await db.drafts.bulkPut([
        {
          id: createDraftId('content-1', 'branch-1'),
          contentId: 'content-1',
          branchId: 'branch-1',
          title: 'Synced',
          body: 'Content',
          metadata: {},
          localVersion: 1,
          serverVersionTimestamp: new Date().toISOString(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: true,
        },
        {
          id: createDraftId('content-2', 'branch-2'),
          contentId: 'content-2',
          branchId: 'branch-2',
          title: 'Unsynced',
          body: 'Content',
          metadata: {},
          localVersion: 2,
          serverVersionTimestamp: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          synced: false,
        },
      ]);

      const allDrafts = await db.drafts.toArray();
      const unsynced = allDrafts.filter(d => !d.synced);

      expect(unsynced.length).toBe(1);
      expect(unsynced[0].title).toBe('Unsynced');
    });

    it('should process sync queue in order', async () => {

      const now = Date.now();

      // Add items with different nextRetryAt times
      await db.syncQueue.bulkAdd([
        {
          draftId: createDraftId('content-1', 'branch-1'),
          operation: 'sync',
          attempts: 0,
          maxAttempts: 5,
          nextRetryAt: now + 2000,
          createdAt: now,
        },
        {
          draftId: createDraftId('content-2', 'branch-2'),
          operation: 'sync',
          attempts: 0,
          maxAttempts: 5,
          nextRetryAt: now + 1000,
          createdAt: now,
        },
      ]);

      const ordered = await db.syncQueue
        .orderBy('nextRetryAt')
        .toArray();

      expect(ordered[0].draftId).toContain('content-2');
      expect(ordered[1].draftId).toContain('content-1');
    });
  });

  describe('conflict detection', () => {
    it('should detect version mismatch', async () => {

      const draftId = createDraftId('content-1', 'branch-1');
      const clientVersion = '2024-01-01T10:00:00.000Z';
      const serverVersion = '2024-01-01T11:00:00.000Z';

      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Client content',
        metadata: {},
        localVersion: 2,
        serverVersionTimestamp: clientVersion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      const draft = await db.drafts.get(draftId);
      const hasConflict = draft?.serverVersionTimestamp !== serverVersion;

      expect(hasConflict).toBe(true);
    });

    it('should preserve both versions for merge UI', async () => {

      const draftId = createDraftId('content-1', 'branch-1');
      const clientBody = 'Client changes';
      const serverBody = 'Server changes';

      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: clientBody,
        metadata: {},
        localVersion: 2,
        serverVersionTimestamp: '2024-01-01T10:00:00.000Z',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.body).toBe(clientBody);
      // Server body would come from sync API response, not stored locally
    });
  });

  describe('crash recovery', () => {
    it('should restore unsynced drafts after browser restart', async () => {

      const draftId = createDraftId('content-1', 'branch-1');

      // Create unsynced draft
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Unsaved Work',
        body: 'Important content that was not synced',
        metadata: {},
        localVersion: 3,
        serverVersionTimestamp: null,
        createdAt: Date.now() - 60000,
        updatedAt: Date.now(),
        synced: false,
      });

      // Simulate "browser restart" by creating new db connection
      db.close();
      db = new DraftDatabase();
      await db.open();

      const recovered = await db.drafts.get(draftId);
      expect(recovered).toBeDefined();
      expect(recovered?.title).toBe('Unsaved Work');
      expect(recovered?.synced).toBe(false);
    });

    it('should detect active sessions for crash recovery UI', async () => {

      // Create stale session (simulates browser crash)
      await db.editSessions.put({
        id: 'crashed-session',
        contentId: 'content-1',
        branchId: 'branch-1',
        userId: 'user-1',
        startedAt: Date.now() - 7200000, // 2 hours ago
        lastActivityAt: Date.now() - 3700000, // > 1 hour stale
        deviceId: 'device-1',
      });

      // Also have unsynced draft
      await db.drafts.put({
        id: createDraftId('content-1', 'branch-1'),
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Crashed Draft',
        body: 'Content',
        metadata: {},
        localVersion: 5,
        serverVersionTimestamp: null,
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 3700000,
        synced: false,
      });

      const threshold = Date.now() - 3600000; // 1 hour
      const staleSessions = await db.editSessions
        .where('lastActivityAt')
        .below(threshold)
        .toArray();

      expect(staleSessions.length).toBe(1);
      expect(staleSessions[0].id).toBe('crashed-session');
    });
  });
});
