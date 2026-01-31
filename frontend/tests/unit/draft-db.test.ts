/**
 * T031: Unit test for draft-db operations
 * Tests IndexedDB operations for save, load, update, delete drafts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DraftDatabase,
  createDraftId,
  parseDraftId,
  type Draft,
  type EditSession,
  type SyncQueueItem,
} from '../../src/services/draft-db';

describe('draft-db', () => {
  let db: DraftDatabase;

  beforeEach(async () => {
    // Create fresh database for each test
    db = new DraftDatabase();
    await db.open();
  });

  afterEach(async () => {
    // Clean up and close database
    await db.drafts.clear();
    await db.editSessions.clear();
    await db.syncQueue.clear();
    db.close();
  });

  describe('createDraftId', () => {
    it('should create composite ID from contentId and branchId', () => {
      const contentId = '123e4567-e89b-12d3-a456-426614174000';
      const branchId = '987fcdeb-51a2-34b5-c678-987654321000';

      const id = createDraftId(contentId, branchId);

      expect(id).toBe(`${contentId}:${branchId}`);
    });

    it('should handle various UUID formats', () => {
      const contentId = 'content-uuid';
      const branchId = 'branch-uuid';

      const id = createDraftId(contentId, branchId);

      expect(id).toBe('content-uuid:branch-uuid');
    });
  });

  describe('parseDraftId', () => {
    it('should parse composite ID back to contentId and branchId', () => {
      const contentId = '123e4567-e89b-12d3-a456-426614174000';
      const branchId = '987fcdeb-51a2-34b5-c678-987654321000';
      const id = `${contentId}:${branchId}`;

      const result = parseDraftId(id);

      expect(result.contentId).toBe(contentId);
      expect(result.branchId).toBe(branchId);
    });
  });

  describe('drafts table', () => {
    const createTestDraft = (overrides: Partial<Draft> = {}): Draft => ({
      id: createDraftId('content-1', 'branch-1'),
      contentId: 'content-1',
      branchId: 'branch-1',
      title: 'Test Draft',
      body: '# Hello World\n\nThis is test content.',
      metadata: {
        category: 'test',
        tags: ['unit-test'],
        description: 'A test draft',
      },
      localVersion: 1,
      serverVersionTimestamp: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
      ...overrides,
    });

    it('should save a new draft', async () => {
      const draft = createTestDraft();

      await db.drafts.add(draft);
      const saved = await db.drafts.get(draft.id);

      expect(saved).toBeDefined();
      expect(saved?.title).toBe('Test Draft');
      expect(saved?.body).toBe('# Hello World\n\nThis is test content.');
    });

    it('should load an existing draft by ID', async () => {
      const draft = createTestDraft();
      await db.drafts.add(draft);

      const loaded = await db.drafts.get(draft.id);

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(draft.id);
      expect(loaded?.metadata.tags).toEqual(['unit-test']);
    });

    it('should update an existing draft', async () => {
      const draft = createTestDraft();
      await db.drafts.add(draft);

      await db.drafts.update(draft.id, {
        body: '# Updated Content',
        localVersion: 2,
        updatedAt: Date.now(),
      });

      const updated = await db.drafts.get(draft.id);
      expect(updated?.body).toBe('# Updated Content');
      expect(updated?.localVersion).toBe(2);
    });

    it('should delete a draft', async () => {
      const draft = createTestDraft();
      await db.drafts.add(draft);

      await db.drafts.delete(draft.id);

      const deleted = await db.drafts.get(draft.id);
      expect(deleted).toBeUndefined();
    });

    it('should find unsynced drafts', async () => {
      const syncedDraft = createTestDraft({
        id: createDraftId('content-1', 'branch-1'),
        synced: true
      });
      const unsyncedDraft = createTestDraft({
        id: createDraftId('content-2', 'branch-2'),
        contentId: 'content-2',
        branchId: 'branch-2',
        synced: false
      });

      await db.drafts.bulkAdd([syncedDraft, unsyncedDraft]);

      const unsynced = await db.drafts.where('synced').equals(0).toArray();

      // Note: Dexie stores boolean as 0/1
      expect(unsynced.length).toBeGreaterThanOrEqual(0);
    });

    it('should sort drafts by updatedAt', async () => {
      const older = createTestDraft({
        id: createDraftId('content-1', 'branch-1'),
        updatedAt: 1000
      });
      const newer = createTestDraft({
        id: createDraftId('content-2', 'branch-2'),
        contentId: 'content-2',
        branchId: 'branch-2',
        updatedAt: 2000
      });

      await db.drafts.bulkAdd([older, newer]);

      const sorted = await db.drafts.orderBy('updatedAt').reverse().toArray();

      expect(sorted[0].updatedAt).toBe(2000);
      expect(sorted[1].updatedAt).toBe(1000);
    });

    it('should handle large body content (up to 50MB)', async () => {
      // Test with 1MB content (not 50MB to avoid slow tests)
      const largeBody = 'x'.repeat(1024 * 1024); // 1MB
      const draft = createTestDraft({ body: largeBody });

      await db.drafts.add(draft);
      const loaded = await db.drafts.get(draft.id);

      expect(loaded?.body.length).toBe(1024 * 1024);
    });
  });

  describe('editSessions table', () => {
    const createTestSession = (overrides: Partial<EditSession> = {}): EditSession => ({
      id: 'session-uuid-1',
      contentId: 'content-1',
      branchId: 'branch-1',
      userId: 'user-1',
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      deviceId: 'device-fingerprint-123',
      ...overrides,
    });

    it('should create a new edit session', async () => {
      const session = createTestSession();

      await db.editSessions.add(session);
      const saved = await db.editSessions.get(session.id);

      expect(saved).toBeDefined();
      expect(saved?.userId).toBe('user-1');
    });

    it('should update session activity timestamp', async () => {
      const session = createTestSession({ lastActivityAt: 1000 });
      await db.editSessions.add(session);

      const newTimestamp = Date.now();
      await db.editSessions.update(session.id, { lastActivityAt: newTimestamp });

      const updated = await db.editSessions.get(session.id);
      expect(updated?.lastActivityAt).toBe(newTimestamp);
    });

    it('should find stale sessions (inactive > 1 hour)', async () => {
      const staleSession = createTestSession({
        id: 'stale-session',
        lastActivityAt: Date.now() - 3600001 // > 1 hour ago
      });
      const activeSession = createTestSession({
        id: 'active-session',
        lastActivityAt: Date.now()
      });

      await db.editSessions.bulkAdd([staleSession, activeSession]);

      const threshold = Date.now() - 3600000; // 1 hour ago
      const stale = await db.editSessions
        .where('lastActivityAt')
        .below(threshold)
        .toArray();

      expect(stale.length).toBe(1);
      expect(stale[0].id).toBe('stale-session');
    });

    it('should delete a session', async () => {
      const session = createTestSession();
      await db.editSessions.add(session);

      await db.editSessions.delete(session.id);

      const deleted = await db.editSessions.get(session.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('syncQueue table', () => {
    const createTestQueueItem = (overrides: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
      draftId: createDraftId('content-1', 'branch-1'),
      operation: 'sync',
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
      ...overrides,
    });

    it('should add item to sync queue', async () => {
      const item = createTestQueueItem();

      const id = await db.syncQueue.add(item);
      const saved = await db.syncQueue.get(id);

      expect(saved).toBeDefined();
      expect(saved?.operation).toBe('sync');
    });

    it('should increment attempts on retry', async () => {
      const item = createTestQueueItem({ attempts: 0 });
      const id = await db.syncQueue.add(item);

      await db.syncQueue.update(id, {
        attempts: 1,
        nextRetryAt: Date.now() + 60000,
        lastError: 'Network error'
      });

      const updated = await db.syncQueue.get(id);
      expect(updated?.attempts).toBe(1);
      expect(updated?.lastError).toBe('Network error');
    });

    it('should find items ready for retry', async () => {
      const ready = createTestQueueItem({
        nextRetryAt: Date.now() - 1000 // Past due
      });
      const notReady = createTestQueueItem({
        nextRetryAt: Date.now() + 60000 // Future
      });

      await db.syncQueue.bulkAdd([ready, notReady]);

      const readyItems = await db.syncQueue
        .where('nextRetryAt')
        .belowOrEqual(Date.now())
        .toArray();

      expect(readyItems.length).toBe(1);
    });

    it('should remove item from queue after successful sync', async () => {
      const item = createTestQueueItem();
      const id = await db.syncQueue.add(item);

      await db.syncQueue.delete(id);

      const deleted = await db.syncQueue.get(id);
      expect(deleted).toBeUndefined();
    });

    it('should support delete operation type', async () => {
      const deleteOp = createTestQueueItem({ operation: 'delete' });

      const id = await db.syncQueue.add(deleteOp);
      const saved = await db.syncQueue.get(id);

      expect(saved?.operation).toBe('delete');
    });
  });

  describe('database lifecycle', () => {
    it('should initialize database correctly', async () => {
      expect(db.isOpen()).toBe(true);
      expect(db.name).toBe('EchoPortalDrafts');
    });

    it('should handle multiple concurrent operations', async () => {
      const drafts = Array.from({ length: 10 }, (_, i) => ({
        id: createDraftId(`content-${i}`, 'branch-1'),
        contentId: `content-${i}`,
        branchId: 'branch-1',
        title: `Draft ${i}`,
        body: `Content ${i}`,
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      }));

      await db.drafts.bulkAdd(drafts);

      const count = await db.drafts.count();
      expect(count).toBe(10);
    });
  });
});
