import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so NO outer-scope variable references
// ---------------------------------------------------------------------------

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: { notifications: { findMany: vi.fn() } },
  },
  schema: {
    // Re-export every schema table used by the service — field-name stubs
    notifications: {
      id: 'id',
      userId: 'userId',
      type: 'type',
      category: 'category',
      title: 'title',
      message: 'message',
      resourceType: 'resourceType',
      resourceId: 'resourceId',
      actorId: 'actorId',
      isRead: 'isRead',
      createdAt: 'createdAt',
      readAt: 'readAt',
    },
    users: {
      id: 'id',
      displayName: 'displayName',
      isActive: 'isActive',
      roles: 'roles',
    },
    branches: {
      id: 'id',
      visibility: 'visibility',
      ownerId: 'ownerId',
      collaborators: 'collaborators',
      reviewers: 'reviewers',
    },
    notificationPreferences: {
      id: 'id',
      userId: 'userId',
      category: 'category',
      enabled: 'enabled',
      updatedAt: 'updatedAt',
    },
  },
}));

// Mock individual schema modules so transitive imports resolve
vi.mock('../../src/db/schema/notifications', () => ({
  notifications: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    category: 'category',
    title: 'title',
    message: 'message',
    resourceType: 'resourceType',
    resourceId: 'resourceId',
    actorId: 'actorId',
    isRead: 'isRead',
    createdAt: 'createdAt',
    readAt: 'readAt',
  },
}));

vi.mock('../../src/db/schema/users', () => ({
  users: {
    id: 'id',
    displayName: 'displayName',
    isActive: 'isActive',
    roles: 'roles',
  },
}));

vi.mock('../../src/db/schema/branches', () => ({
  branches: {
    id: 'id',
    visibility: 'visibility',
    ownerId: 'ownerId',
    collaborators: 'collaborators',
    reviewers: 'reviewers',
  },
}));

vi.mock('../../src/db/schema/notification-preferences', () => ({
  notificationPreferences: {
    id: 'id',
    userId: 'userId',
    category: 'category',
    enabled: 'enabled',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('../../src/db/schema/index', () => ({
  notifications: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    category: 'category',
    title: 'title',
    message: 'message',
    resourceType: 'resourceType',
    resourceId: 'resourceId',
    actorId: 'actorId',
    isRead: 'isRead',
    createdAt: 'createdAt',
    readAt: 'readAt',
  },
  users: {
    id: 'id',
    displayName: 'displayName',
    isActive: 'isActive',
    roles: 'roles',
  },
  branches: {
    id: 'id',
    visibility: 'visibility',
    ownerId: 'ownerId',
    collaborators: 'collaborators',
    reviewers: 'reviewers',
  },
  notificationPreferences: {
    id: 'id',
    userId: 'userId',
    category: 'category',
    enabled: 'enabled',
    updatedAt: 'updatedAt',
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  auditLogger: { log: vi.fn().mockResolvedValue('audit-id') },
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue('audit-id'),
  })),
}));

// Mock notification SSE
vi.mock('../../src/services/notification/notification-sse', () => ({
  notificationSSE: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishCount: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

// Mock shared module
vi.mock('@echo-portal/shared', () => ({
  NOTIFICATION_TYPE_TO_CATEGORY: {
    review_requested: 'review',
    review_comment_added: 'review',
    review_comment_reply: 'review',
    review_approved: 'review',
    review_changes_requested: 'review',
    reviewer_added: 'review',
    reviewer_removed: 'review',
    collaborator_added: 'lifecycle',
    collaborator_removed: 'lifecycle',
    content_published: 'lifecycle',
    branch_archived: 'lifecycle',
    role_changed: 'lifecycle',
    ai_compliance_error: 'ai',
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings,
    values,
  })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

// ---------------------------------------------------------------------------
// Imports — AFTER all vi.mock calls so hoisting resolves correctly
// ---------------------------------------------------------------------------

import { db } from '../../src/db';
import { auditLogger } from '../../src/services/audit/logger';
import { notificationService } from '../../src/services/notification/notification-service';

// ---------------------------------------------------------------------------
// Test IDs — valid UUID format
// ---------------------------------------------------------------------------

const USER_A = '00000000-0000-4000-a000-000000000001';
const USER_B = '00000000-0000-4000-a000-000000000002';
const USER_C = '00000000-0000-4000-a000-000000000003';
const USER_D = '00000000-0000-4000-a000-000000000004';
const ACTOR = '00000000-0000-4000-a000-000000000099';
const BRANCH_ID = '00000000-0000-4000-b000-000000000001';
const NOTIFICATION_ID = '00000000-0000-4000-c000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock chain for db.select().from().where() and optional continuations.
 * The `.where()` mock both resolves to `resolved` (for direct await) AND exposes
 * `.limit()` / `.orderBy()` for queries that chain further.
 */
function mockSelectChain(resolved: unknown) {
  const whereResult = Object.assign(Promise.resolve(resolved), {
    limit: vi.fn().mockResolvedValue(resolved),
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue(resolved),
      }),
    }),
  });
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(resolved),
            }),
          }),
        }),
      }),
    }),
  };
}

function mockInsertChain(resolved: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(resolved),
      onConflictDoUpdate: vi.fn().mockResolvedValue(resolved),
    }),
  };
}

function mockUpdateChain(resolved: unknown) {
  const whereResult = Object.assign(Promise.resolve(resolved), {
    returning: vi.fn().mockResolvedValue(resolved),
  });
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

/** Create a fake notification DB row. */
function fakeNotificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: USER_A,
    type: 'review_requested',
    category: 'review',
    title: 'Review requested',
    message: 'Please review branch X',
    resourceType: 'branch',
    resourceId: BRANCH_ID,
    actorId: ACTOR,
    isRead: false,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    readAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // resolveRecipients
  // =========================================================================
  describe('resolveRecipients()', () => {
    it('returns empty array for empty input', async () => {
      const result = await notificationService.resolveRecipients([], ACTOR, 'review');
      expect(result).toEqual([]);
      // db should never be called
      expect(db.select).not.toHaveBeenCalled();
    });

    it('removes the actor (self-suppression)', async () => {
      // Step 2 — active users check: both users active
      const selectActiveUsers = mockSelectChain([{ id: USER_B }]);
      // Step 4 — preference check: no disabled prefs
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers) // active user query
        .mockReturnValueOnce(selectDisabledPrefs); // preference query

      const result = await notificationService.resolveRecipients(
        [ACTOR, USER_B],
        ACTOR,
        'review',
      );

      expect(result).not.toContain(ACTOR);
      expect(result).toContain(USER_B);
    });

    it('returns all userIds when actorId is undefined', async () => {
      const selectActiveUsers = mockSelectChain([{ id: USER_A }, { id: USER_B }]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
      );

      expect(result).toEqual([USER_A, USER_B]);
    });

    it('filters deactivated users', async () => {
      // Only USER_A is active; USER_B is deactivated
      const selectActiveUsers = mockSelectChain([{ id: USER_A }]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
      );

      expect(result).toEqual([USER_A]);
      expect(result).not.toContain(USER_B);
    });

    it('returns empty when all users are deactivated', async () => {
      const selectActiveUsers = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActiveUsers);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
      );

      expect(result).toEqual([]);
    });

    it('enforces private branch visibility — only owner/collaborators/reviewers/admins', async () => {
      // Active users: A, B, C, D
      const selectActiveUsers = mockSelectChain([
        { id: USER_A },
        { id: USER_B },
        { id: USER_C },
        { id: USER_D },
      ]);
      // Branch query: private, owner=A, collaborators=[B], reviewers=[C]
      const selectBranch = mockSelectChain([
        {
          visibility: 'private',
          ownerId: USER_A,
          collaborators: [USER_B],
          reviewers: [USER_C],
        },
      ]);
      // Admin query: D is admin
      const selectAdmins = mockSelectChain([{ id: USER_D }]);
      // Preference check: no disabled
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers) // step 2
        .mockReturnValueOnce(selectBranch) // step 3a — branch lookup
        .mockReturnValueOnce(selectAdmins) // step 3b — admin lookup
        .mockReturnValueOnce(selectDisabledPrefs); // step 4

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B, USER_C, USER_D],
        undefined,
        'review',
        BRANCH_ID,
      );

      // All four should remain: A=owner, B=collaborator, C=reviewer, D=admin
      expect(result).toContain(USER_A);
      expect(result).toContain(USER_B);
      expect(result).toContain(USER_C);
      expect(result).toContain(USER_D);
    });

    it('excludes non-member users from private branches', async () => {
      // Active users: A, B, C
      const selectActiveUsers = mockSelectChain([
        { id: USER_A },
        { id: USER_B },
        { id: USER_C },
      ]);
      // Branch is private, owner=A only, no collaborators/reviewers
      const selectBranch = mockSelectChain([
        {
          visibility: 'private',
          ownerId: USER_A,
          collaborators: [],
          reviewers: [],
        },
      ]);
      // No admins
      const selectAdmins = mockSelectChain([]);
      // No disabled prefs
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectBranch)
        .mockReturnValueOnce(selectAdmins)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B, USER_C],
        undefined,
        'lifecycle',
        BRANCH_ID,
      );

      // Only A (owner) should remain
      expect(result).toEqual([USER_A]);
    });

    it('skips visibility filtering for non-private branches', async () => {
      const selectActiveUsers = mockSelectChain([
        { id: USER_A },
        { id: USER_B },
      ]);
      // Branch is public
      const selectBranch = mockSelectChain([
        {
          visibility: 'public',
          ownerId: USER_A,
          collaborators: [],
          reviewers: [],
        },
      ]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectBranch)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
        BRANCH_ID,
      );

      // Both should remain — no visibility filtering for non-private
      expect(result).toContain(USER_A);
      expect(result).toContain(USER_B);
    });

    it('respects disabled preferences', async () => {
      const selectActiveUsers = mockSelectChain([
        { id: USER_A },
        { id: USER_B },
      ]);
      // USER_B has disabled 'review' preference
      const selectDisabledPrefs = mockSelectChain([{ userId: USER_B }]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
      );

      expect(result).toEqual([USER_A]);
      expect(result).not.toContain(USER_B);
    });

    it('applies multiple filters combined: self-suppression + deactivated + preferences', async () => {
      // ACTOR excluded by self-suppression
      // USER_B is deactivated (not in active list)
      // USER_C has preference disabled
      // USER_A passes all filters
      const selectActiveUsers = mockSelectChain([{ id: USER_A }, { id: USER_C }]);
      const selectDisabledPrefs = mockSelectChain([{ userId: USER_C }]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [ACTOR, USER_A, USER_B, USER_C],
        ACTOR,
        'lifecycle',
      );

      expect(result).toEqual([USER_A]);
    });

    it('returns empty when only user is the actor', async () => {
      const result = await notificationService.resolveRecipients(
        [ACTOR],
        ACTOR,
        'review',
      );

      expect(result).toEqual([]);
      // Should not even query DB since filtered is empty after self-suppression
      expect(db.select).not.toHaveBeenCalled();
    });

    it('handles null collaborators and reviewers on private branch', async () => {
      const selectActiveUsers = mockSelectChain([{ id: USER_A }, { id: USER_B }]);
      // Branch private with null collaborators/reviewers
      const selectBranch = mockSelectChain([
        {
          visibility: 'private',
          ownerId: USER_A,
          collaborators: null,
          reviewers: null,
        },
      ]);
      const selectAdmins = mockSelectChain([]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectBranch)
        .mockReturnValueOnce(selectAdmins)
        .mockReturnValueOnce(selectDisabledPrefs);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B],
        undefined,
        'review',
        BRANCH_ID,
      );

      // Only owner A should pass
      expect(result).toEqual([USER_A]);
    });

    it('returns empty when all filtered out by private branch visibility', async () => {
      const selectActiveUsers = mockSelectChain([{ id: USER_B }]);
      // Branch private, owner=A (not in active list above), no collab/reviewers
      const selectBranch = mockSelectChain([
        {
          visibility: 'private',
          ownerId: USER_A,
          collaborators: [],
          reviewers: [],
        },
      ]);
      const selectAdmins = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectBranch)
        .mockReturnValueOnce(selectAdmins);

      const result = await notificationService.resolveRecipients(
        [USER_B],
        undefined,
        'review',
        BRANCH_ID,
      );

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getPreferences
  // =========================================================================
  describe('getPreferences()', () => {
    it('returns all 3 categories with defaults when no preferences exist', async () => {
      const selectChain = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const result = await notificationService.getPreferences(USER_A);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { category: 'review', enabled: true },
        { category: 'lifecycle', enabled: true },
        { category: 'ai', enabled: true },
      ]);
    });

    it('returns saved preferences merged with defaults for missing categories', async () => {
      const selectChain = mockSelectChain([
        { category: 'review', enabled: false },
      ]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const result = await notificationService.getPreferences(USER_A);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { category: 'review', enabled: false },
        { category: 'lifecycle', enabled: true },
        { category: 'ai', enabled: true },
      ]);
    });

    it('returns all saved preferences when all categories exist', async () => {
      const selectChain = mockSelectChain([
        { category: 'review', enabled: true },
        { category: 'lifecycle', enabled: false },
        { category: 'ai', enabled: false },
      ]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const result = await notificationService.getPreferences(USER_A);

      expect(result).toEqual([
        { category: 'review', enabled: true },
        { category: 'lifecycle', enabled: false },
        { category: 'ai', enabled: false },
      ]);
    });
  });

  // =========================================================================
  // updatePreference
  // =========================================================================
  describe('updatePreference()', () => {
    it('upserts preference and calls audit logger', async () => {
      // Existing preference lookup — none found
      const selectChain = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      // Insert (upsert)
      const insertChain = mockInsertChain([]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.updatePreference(USER_A, 'review', false);

      expect(result).toEqual({ category: 'review', enabled: false });
      expect(db.insert).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'notification_preference_changed',
          actorId: USER_A,
          actorType: 'user',
          resourceType: 'user',
          resourceId: USER_A,
          metadata: { category: 'review', oldValue: true, newValue: false },
        }),
      );
    });

    it('records old value from existing preference in audit metadata', async () => {
      // Existing preference: enabled = true
      const selectChain = mockSelectChain([{ enabled: true }]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const insertChain = mockInsertChain([]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.updatePreference(USER_A, 'lifecycle', false);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { category: 'lifecycle', oldValue: true, newValue: false },
        }),
      );
    });

    it('defaults old value to true when no existing preference', async () => {
      const selectChain = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const insertChain = mockInsertChain([]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.updatePreference(USER_A, 'ai', true);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { category: 'ai', oldValue: true, newValue: true },
        }),
      );
    });

    it('returns the category and enabled value', async () => {
      const selectChain = mockSelectChain([{ enabled: false }]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const insertChain = mockInsertChain([]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.updatePreference(USER_A, 'review', true);

      expect(result).toEqual({ category: 'review', enabled: true });
    });
  });

  // =========================================================================
  // markAllRead
  // =========================================================================
  describe('markAllRead()', () => {
    it('bulk marks unread notifications as read and returns count', async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 5 }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const count = await notificationService.markAllRead(USER_A);

      expect(count).toBe(5);
      expect(db.update).toHaveBeenCalled();
    });

    it('calls audit logger when count > 0', async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 3 }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      await notificationService.markAllRead(USER_A);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'notifications_bulk_read',
          actorId: USER_A,
          actorType: 'user',
          resourceType: 'user',
          resourceId: USER_A,
          metadata: { count: 3 },
        }),
      );
    });

    it('skips audit logger when count is 0', async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const count = await notificationService.markAllRead(USER_A);

      expect(count).toBe(0);
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('treats null rowCount as 0', async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: null }),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const count = await notificationService.markAllRead(USER_A);

      expect(count).toBe(0);
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('treats undefined rowCount as 0', async () => {
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const count = await notificationService.markAllRead(USER_A);

      expect(count).toBe(0);
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create()', () => {
    it('derives category from type via NOTIFICATION_TYPE_TO_CATEGORY', async () => {
      const row = fakeNotificationRow({ category: 'review' });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'review_requested',
        title: 'Review requested',
        message: 'Please review',
        actorId: ACTOR,
      });

      expect(result.category).toBe('review');
      expect(result.id).toBe(NOTIFICATION_ID);
    });

    it('uses explicit category when provided', async () => {
      const row = fakeNotificationRow({ category: 'ai' });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'ai_compliance_error',
        title: 'Compliance issue',
        message: 'Image issue found',
        category: 'ai',
        actorId: ACTOR,
      });

      expect(result.category).toBe('ai');
    });

    it('falls back to review when type is unknown and no explicit category', async () => {
      const row = fakeNotificationRow({ type: 'unknown_type', category: 'review' });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'unknown_type',
        title: 'Something',
        message: 'Something happened',
      });

      expect(result.category).toBe('review');
    });

    it('includes actorId in the created notification', async () => {
      const row = fakeNotificationRow();
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'review_requested',
        title: 'Review requested',
        message: 'Please review',
        actorId: ACTOR,
      });

      expect(result.actorId).toBe(ACTOR);
    });

    it('formats the response with ISO date strings', async () => {
      const date = new Date('2026-01-15T12:00:00Z');
      const row = fakeNotificationRow({ createdAt: date, readAt: null });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'review_requested',
        title: 'Test',
        message: 'Test',
      });

      expect(result.createdAt).toBe(date.toISOString());
      expect(result.readAt).toBeUndefined();
    });

    it('includes resourceType and resourceId when provided', async () => {
      const row = fakeNotificationRow({
        resourceType: 'branch',
        resourceId: BRANCH_ID,
      });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'review_requested',
        title: 'Review',
        message: 'Review branch',
        resourceType: 'branch',
        resourceId: BRANCH_ID,
      });

      expect(result.resourceType).toBe('branch');
      expect(result.resourceId).toBe(BRANCH_ID);
    });

    it('derives lifecycle category from lifecycle type', async () => {
      const row = fakeNotificationRow({ type: 'content_published', category: 'lifecycle' });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'content_published',
        title: 'Published',
        message: 'Content was published',
      });

      expect(result.category).toBe('lifecycle');
    });
  });

  // =========================================================================
  // createBulk
  // =========================================================================
  describe('createBulk()', () => {
    it('returns early for empty userIds', async () => {
      await notificationService.createBulk([], {
        type: 'review_requested',
        title: 'Review',
        message: 'Review',
      });

      expect(db.select).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('calls resolveRecipients by default and inserts for resolved users', async () => {
      // resolveRecipients calls:
      // 1. Active users
      const selectActiveUsers = mockSelectChain([{ id: USER_A }, { id: USER_B }]);
      // 2. Preference check
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      // Insert for bulk — must include .returning() since createBulk calls it
      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A }),
        fakeNotificationRow({ userId: USER_B }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [ACTOR, USER_A, USER_B],
        {
          type: 'review_requested',
          title: 'Review needed',
          message: 'Please review',
          actorId: ACTOR,
        },
      );

      expect(db.insert).toHaveBeenCalled();
      // The values call should receive an array of notification objects
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: USER_A }),
          expect.objectContaining({ userId: USER_B }),
        ]),
      );
    });

    it('skips filtering when skipFiltering is true', async () => {
      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A }),
        fakeNotificationRow({ userId: USER_B }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [USER_A, USER_B],
        {
          type: 'review_requested',
          title: 'Review',
          message: 'Review',
          actorId: ACTOR,
        },
        { skipFiltering: true },
      );

      // Insert should include both users (resolveRecipients was skipped)
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: USER_A }),
          expect.objectContaining({ userId: USER_B }),
        ]),
      );
    });

    it('does not insert when resolveRecipients returns empty', async () => {
      // All recipients filtered out — only actor in list
      // No active users after self-suppression empties the list
      const result = await notificationService.createBulk(
        [ACTOR],
        {
          type: 'review_requested',
          title: 'Review',
          message: 'Review',
          actorId: ACTOR,
        },
      );

      // After self-suppression, filtered is empty, so resolveRecipients returns []
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('passes branchId to resolveRecipients', async () => {
      // Active users
      const selectActiveUsers = mockSelectChain([{ id: USER_A }]);
      // Branch lookup (public, so no extra filtering)
      const selectBranch = mockSelectChain([
        { visibility: 'public', ownerId: USER_A, collaborators: [], reviewers: [] },
      ]);
      // Prefs
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectBranch)
        .mockReturnValueOnce(selectDisabledPrefs);

      const insertChain = mockInsertChain([fakeNotificationRow({ userId: USER_A })]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [USER_A],
        {
          type: 'collaborator_added',
          title: 'Added',
          message: 'You were added',
        },
        { branchId: BRANCH_ID },
      );

      expect(db.insert).toHaveBeenCalled();
    });

    it('derives category from type for bulk creation', async () => {
      const selectActiveUsers = mockSelectChain([{ id: USER_A }]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A, type: 'branch_archived', category: 'lifecycle' }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [USER_A],
        {
          type: 'branch_archived',
          title: 'Archived',
          message: 'Branch archived',
        },
      );

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ category: 'lifecycle' }),
        ]),
      );
    });
  });

  // =========================================================================
  // list
  // =========================================================================
  describe('list()', () => {
    it('returns paginated items with actorName and total count', async () => {
      const notifRow = fakeNotificationRow();
      const itemsResult = [
        { notification: notifRow, actorName: 'Alice' },
      ];
      const countResult = [{ count: 1 }];

      // list() calls Promise.all with two db.select() calls
      const selectItems = {
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(itemsResult),
                }),
              }),
            }),
          }),
        }),
      };
      const selectCount = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      };

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectItems)
        .mockReturnValueOnce(selectCount);

      const result = await notificationService.list(USER_A, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].actorName).toBe('Alice');
      expect(result.total).toBe(1);
    });

    it('defaults to page 1 and limit 20', async () => {
      const selectItems = {
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };
      const selectCount = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectItems)
        .mockReturnValueOnce(selectCount);

      const result = await notificationService.list(USER_A, {});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('caps limit at 100', async () => {
      const mockLimit = vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue([]),
      });
      const selectItems = {
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };
      const selectCount = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectItems)
        .mockReturnValueOnce(selectCount);

      await notificationService.list(USER_A, { limit: 500 });

      // limit should be capped at 100
      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it('returns total as 0 when countResult is empty', async () => {
      const selectItems = {
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      };
      const selectCount = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      };

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectItems)
        .mockReturnValueOnce(selectCount);

      const result = await notificationService.list(USER_A, {});

      expect(result.total).toBe(0);
    });
  });

  // =========================================================================
  // getUnreadCount
  // =========================================================================
  describe('getUnreadCount()', () => {
    it('returns unread count', async () => {
      const selectChain = mockSelectChain([{ count: 7 }]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const count = await notificationService.getUnreadCount(USER_A);

      expect(count).toBe(7);
    });

    it('returns 0 when no results', async () => {
      const selectChain = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const count = await notificationService.getUnreadCount(USER_A);

      expect(count).toBe(0);
    });

    it('returns 0 when count is null', async () => {
      const selectChain = mockSelectChain([{ count: null }]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

      const count = await notificationService.getUnreadCount(USER_A);

      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // markRead
  // =========================================================================
  describe('markRead()', () => {
    it('marks a notification as read and returns formatted result with actorName', async () => {
      const readAt = new Date('2026-01-16T00:00:00Z');
      const updatedRow = fakeNotificationRow({ isRead: true, readAt });

      const updateChain = mockUpdateChain([updatedRow]);
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      // Actor name lookup
      const selectActor = mockSelectChain([{ displayName: 'Alice' }]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActor);

      const result = await notificationService.markRead(NOTIFICATION_ID, USER_A);

      expect(result).not.toBeNull();
      expect(result!.isRead).toBe(true);
      expect(result!.readAt).toBe(readAt.toISOString());
      expect(result!.actorName).toBe('Alice');
    });

    it('returns null when notification not found', async () => {
      const updateChain = mockUpdateChain([]);
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const result = await notificationService.markRead(NOTIFICATION_ID, USER_A);

      expect(result).toBeNull();
    });

    it('returns result without actorName when actorId is null', async () => {
      const readAt = new Date('2026-01-16T00:00:00Z');
      const updatedRow = fakeNotificationRow({ isRead: true, readAt, actorId: null });

      const updateChain = mockUpdateChain([updatedRow]);
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      const result = await notificationService.markRead(NOTIFICATION_ID, USER_A);

      expect(result).not.toBeNull();
      expect(result!.actorName).toBeUndefined();
      // db.select should NOT be called for actor lookup
      expect(db.select).not.toHaveBeenCalled();
    });

    it('returns actorName as undefined when actor user not found', async () => {
      const readAt = new Date('2026-01-16T00:00:00Z');
      const updatedRow = fakeNotificationRow({ isRead: true, readAt });

      const updateChain = mockUpdateChain([updatedRow]);
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

      // Actor lookup returns nothing
      const selectActor = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActor);

      const result = await notificationService.markRead(NOTIFICATION_ID, USER_A);

      expect(result).not.toBeNull();
      expect(result!.actorName).toBeUndefined();
    });
  });
});
