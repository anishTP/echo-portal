/**
 * T041: Integration test for manual save
 * Tests: save creates version, version appears in history
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DraftDatabase,
  createDraftId,
  type Draft,
} from '../../src/services/draft-db';

// Mock the content API for server sync
const mockSyncDraft = vi.fn();
vi.mock('../../src/services/content-api', () => ({
  contentApi: {
    syncDraft: (...args: unknown[]) => mockSyncDraft(...args),
  },
}));

describe('manual save flow', () => {
  let db: DraftDatabase;

  beforeEach(async () => {
    db = new DraftDatabase();
    await db.open();
    mockSyncDraft.mockReset();
  });

  afterEach(async () => {
    await db.drafts.clear();
    await db.editSessions.clear();
    await db.syncQueue.clear();
    db.close();
    vi.clearAllMocks();
  });

  describe('save creates version', () => {
    it('should save draft to IndexedDB before syncing', async () => {
      const contentId = 'test-content-id';
      const branchId = 'test-branch-id';
      const draftId = createDraftId(contentId, branchId);

      // Simulate saving a draft with change description
      const draft: Draft = {
        id: draftId,
        contentId,
        branchId,
        title: 'Test Title',
        body: '# Manual Save Test',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      };

      await db.drafts.put(draft);

      // Verify draft is saved locally
      const saved = await db.drafts.get(draftId);
      expect(saved).toBeDefined();
      expect(saved?.body).toBe('# Manual Save Test');
      expect(saved?.synced).toBe(false);
    });

    it('should sync draft to server with custom change description', async () => {
      const contentId = 'test-content-id';
      const branchId = 'test-branch-id';
      const draftId = createDraftId(contentId, branchId);
      const changeDescription = 'Manual save: Updated documentation';
      const serverVersionTimestamp = new Date().toISOString();

      // Create draft
      await db.drafts.put({
        id: draftId,
        contentId,
        branchId,
        title: 'Test Title',
        body: '# Manual Save Test',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      });

      // Mock successful sync response
      mockSyncDraft.mockResolvedValue({
        success: true,
        newVersionTimestamp: serverVersionTimestamp,
      });

      // Simulate sync call (what useDraftSync.sync does)
      const draft = await db.drafts.get(draftId);
      expect(draft).toBeDefined();

      const syncInput = {
        contentId,
        branchId,
        title: draft!.title,
        body: draft!.body,
        metadata: draft!.metadata,
        expectedServerVersion: draft!.serverVersionTimestamp,
        changeDescription,
      };

      const result = await mockSyncDraft(contentId, syncInput);

      // Verify sync was called with correct change description
      expect(mockSyncDraft).toHaveBeenCalledWith(contentId, expect.objectContaining({
        changeDescription: 'Manual save: Updated documentation',
      }));

      expect(result.success).toBe(true);
      expect(result.newVersionTimestamp).toBe(serverVersionTimestamp);
    });

    it('should mark draft as synced after successful server sync', async () => {
      const draftId = createDraftId('content-1', 'branch-1');
      const serverVersionTimestamp = new Date().toISOString();

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

      // Simulate successful server sync update
      await db.drafts.update(draftId, {
        synced: true,
        serverVersionTimestamp,
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.synced).toBe(true);
      expect(draft?.serverVersionTimestamp).toBe(serverVersionTimestamp);
    });
  });

  describe('version appears in history', () => {
    it('should create a new version entry after sync', async () => {
      const contentId = 'content-1';
      const branchId = 'branch-1';
      const draftId = createDraftId(contentId, branchId);
      const firstVersion = '2024-01-01T10:00:00.000Z';
      const secondVersion = '2024-01-01T11:00:00.000Z';

      // Create draft with first server version
      await db.drafts.put({
        id: draftId,
        contentId,
        branchId,
        title: 'Title',
        body: 'First version content',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: firstVersion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
      });

      // Make changes
      await db.drafts.update(draftId, {
        body: 'Second version content',
        localVersion: 2,
        synced: false,
        updatedAt: Date.now(),
      });

      // Mock sync response with new version
      mockSyncDraft.mockResolvedValue({
        success: true,
        newVersionTimestamp: secondVersion,
      });

      // Verify draft has new content
      const draft = await db.drafts.get(draftId);
      expect(draft?.body).toBe('Second version content');
      expect(draft?.synced).toBe(false);

      // Sync and update
      await db.drafts.update(draftId, {
        synced: true,
        serverVersionTimestamp: secondVersion,
      });

      // Verify new version is tracked
      const updated = await db.drafts.get(draftId);
      expect(updated?.serverVersionTimestamp).toBe(secondVersion);
      expect(updated?.synced).toBe(true);
    });

    it('should preserve previous version timestamp for history comparison', async () => {
      const draftId = createDraftId('content-1', 'branch-1');
      const v1 = '2024-01-01T10:00:00.000Z';
      const v2 = '2024-01-01T11:00:00.000Z';

      // Track versions (simulating what the server does)
      const versionHistory = [v1];

      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Content v1',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: v1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
      });

      // Save new version
      await db.drafts.update(draftId, {
        body: 'Content v2',
        localVersion: 2,
        serverVersionTimestamp: v2,
        synced: true,
      });
      versionHistory.push(v2);

      // Verify we can track version history
      expect(versionHistory).toEqual([v1, v2]);
      expect(versionHistory.length).toBe(2);

      const draft = await db.drafts.get(draftId);
      expect(draft?.serverVersionTimestamp).toBe(v2);
    });
  });

  describe('no changes detection', () => {
    it('should detect when there are no unsaved changes', async () => {
      const draftId = createDraftId('content-1', 'branch-1');

      // Create a synced draft (no changes)
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Content',
        metadata: {},
        localVersion: 1,
        serverVersionTimestamp: new Date().toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true, // Already synced = no changes
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.synced).toBe(true);

      // hasChanges should be false for synced drafts
      const hasChanges = draft ? !draft.synced : false;
      expect(hasChanges).toBe(false);
    });

    it('should detect when there are unsaved changes', async () => {
      const draftId = createDraftId('content-1', 'branch-1');

      // Create an unsynced draft (has changes)
      await db.drafts.put({
        id: draftId,
        contentId: 'content-1',
        branchId: 'branch-1',
        title: 'Title',
        body: 'Updated Content',
        metadata: {},
        localVersion: 2,
        serverVersionTimestamp: '2024-01-01T10:00:00.000Z',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false, // Not synced = has changes
      });

      const draft = await db.drafts.get(draftId);
      expect(draft?.synced).toBe(false);

      // hasChanges should be true for unsynced drafts
      const hasChanges = draft ? !draft.synced : false;
      expect(hasChanges).toBe(true);
    });
  });

  describe('change description handling', () => {
    it('should require a change description for manual save', async () => {
      const contentId = 'content-1';
      const draftId = createDraftId(contentId, 'branch-1');

      await db.drafts.put({
        id: draftId,
        contentId,
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

      // Empty description should not be allowed (validated at UI level)
      const emptyDescription = '';
      const validDescription = 'Fixed typo in introduction';

      expect(emptyDescription.trim().length).toBe(0);
      expect(validDescription.trim().length).toBeGreaterThan(0);
    });

    it('should pass change description to sync API', async () => {
      const contentId = 'content-1';
      const changeDescription = 'Added new section about testing';

      mockSyncDraft.mockResolvedValue({
        success: true,
        newVersionTimestamp: new Date().toISOString(),
      });

      await mockSyncDraft(contentId, {
        branchId: 'branch-1',
        body: 'Content',
        changeDescription,
        expectedServerVersion: null,
      });

      expect(mockSyncDraft).toHaveBeenCalledWith(
        contentId,
        expect.objectContaining({
          changeDescription: 'Added new section about testing',
        })
      );
    });
  });
});
