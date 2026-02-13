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
    notifications: { id: 'id', userId: 'userId', type: 'type', category: 'category', title: 'title', message: 'message', resourceType: 'resourceType', resourceId: 'resourceId', actorId: 'actorId', isRead: 'isRead', createdAt: 'createdAt', readAt: 'readAt' },
    users: { id: 'id', displayName: 'displayName', isActive: 'isActive', roles: 'roles' },
    branches: { id: 'id', visibility: 'visibility', ownerId: 'ownerId', collaborators: 'collaborators', reviewers: 'reviewers' },
    notificationPreferences: { id: 'id', userId: 'userId', category: 'category', enabled: 'enabled', updatedAt: 'updatedAt' },
  },
}));

vi.mock('../../src/db/schema/notifications', () => ({
  notifications: { id: 'id', userId: 'userId', type: 'type', category: 'category', title: 'title', message: 'message', resourceType: 'resourceType', resourceId: 'resourceId', actorId: 'actorId', isRead: 'isRead', createdAt: 'createdAt', readAt: 'readAt' },
}));

vi.mock('../../src/db/schema/users', () => ({
  users: { id: 'id', displayName: 'displayName', isActive: 'isActive', roles: 'roles' },
}));

vi.mock('../../src/db/schema/branches', () => ({
  branches: { id: 'id', visibility: 'visibility', ownerId: 'ownerId', collaborators: 'collaborators', reviewers: 'reviewers' },
}));

vi.mock('../../src/db/schema/notification-preferences', () => ({
  notificationPreferences: { id: 'id', userId: 'userId', category: 'category', enabled: 'enabled', updatedAt: 'updatedAt' },
}));

vi.mock('../../src/db/schema/index', () => ({
  notifications: { id: 'id', userId: 'userId', type: 'type', category: 'category', title: 'title', message: 'message', resourceType: 'resourceType', resourceId: 'resourceId', actorId: 'actorId', isRead: 'isRead', createdAt: 'createdAt', readAt: 'readAt' },
  users: { id: 'id', displayName: 'displayName', isActive: 'isActive', roles: 'roles' },
  branches: { id: 'id', visibility: 'visibility', ownerId: 'ownerId', collaborators: 'collaborators', reviewers: 'reviewers' },
  notificationPreferences: { id: 'id', userId: 'userId', category: 'category', enabled: 'enabled', updatedAt: 'updatedAt' },
}));

vi.mock('../../src/services/audit/logger', () => ({
  auditLogger: { log: vi.fn().mockResolvedValue('audit-id') },
  AuditLogger: vi.fn().mockImplementation(() => ({ log: vi.fn().mockResolvedValue('audit-id') })),
}));

vi.mock('../../src/services/notification/notification-sse', () => ({
  notificationSSE: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishCount: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('@echo-portal/shared', () => ({
  NOTIFICATION_TYPE_TO_CATEGORY: {
    review_requested: 'review', review_comment_added: 'review', review_comment_reply: 'review',
    review_approved: 'review', review_changes_requested: 'review', reviewer_added: 'review', reviewer_removed: 'review',
    collaborator_added: 'lifecycle', collaborator_removed: 'lifecycle', content_published: 'lifecycle',
    branch_archived: 'lifecycle', role_changed: 'lifecycle', ai_compliance_error: 'ai',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

// ---------------------------------------------------------------------------
// Imports — AFTER all vi.mock calls so hoisting resolves correctly
// ---------------------------------------------------------------------------

import { db } from '../../src/db';
import { notificationService } from '../../src/services/notification/notification-service';

// ---------------------------------------------------------------------------
// Test IDs — valid UUID format
// ---------------------------------------------------------------------------

const USER_A = '00000000-0000-4000-a000-000000000001';
const USER_B = '00000000-0000-4000-a000-000000000002';
const USER_C = '00000000-0000-4000-a000-000000000003';
const ACTOR = '00000000-0000-4000-a000-000000000099';
const BRANCH_ID = '00000000-0000-4000-b000-000000000001';
const NOTIFICATION_ID = '00000000-0000-4000-c000-000000000001';

// A branch that has been deleted — the resource no longer exists
const DELETED_BRANCH_ID = '00000000-0000-4000-b000-000000000099';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('notification-edge-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Deactivated user receives zero notifications via resolveRecipients
  // =========================================================================
  describe('deactivated user receives zero notifications', () => {
    it('resolveRecipients returns empty array when all users are deactivated', async () => {
      // Active users query returns empty — all users are deactivated
      const selectActiveUsers = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActiveUsers);

      const result = await notificationService.resolveRecipients(
        [USER_A, USER_B, USER_C],
        undefined,
        'review',
      );

      expect(result).toEqual([]);
    });

    it('createBulk with only deactivated users results in no insert', async () => {
      // resolveRecipients: active users query returns empty
      const selectActiveUsers = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActiveUsers);

      await notificationService.createBulk(
        [USER_A, USER_B],
        {
          type: 'review_requested',
          title: 'Review needed',
          message: 'Please review this branch',
          actorId: ACTOR,
        },
      );

      // No insert should occur since all recipients were filtered out
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('resolveRecipients with single deactivated user returns empty', async () => {
      const selectActiveUsers = mockSelectChain([]);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectActiveUsers);

      const result = await notificationService.resolveRecipients(
        [USER_A],
        undefined,
        'lifecycle',
      );

      expect(result).toEqual([]);
      // Should not proceed to preference checking since filtered list is empty
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Self-suppression with actor as only recipient
  // =========================================================================
  describe('self-suppression with actor as only recipient', () => {
    it('createBulk does not insert when actor is the only recipient', async () => {
      await notificationService.createBulk(
        [ACTOR],
        {
          type: 'review_requested',
          title: 'Review',
          message: 'Please review',
          actorId: ACTOR,
        },
      );

      // After self-suppression, filtered is empty so no DB calls for active users
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('resolveRecipients returns empty when actor is sole user', async () => {
      const result = await notificationService.resolveRecipients(
        [ACTOR],
        ACTOR,
        'review',
      );

      expect(result).toEqual([]);
      // Should not even query DB since filtered is empty after self-suppression
      expect(db.select).not.toHaveBeenCalled();
    });

    it('createBulk with actor and other users only notifies other users', async () => {
      // resolveRecipients: USER_A is active (ACTOR removed by self-suppression)
      const selectActiveUsers = mockSelectChain([{ id: USER_A }]);
      const selectDisabledPrefs = mockSelectChain([]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(selectActiveUsers)
        .mockReturnValueOnce(selectDisabledPrefs);

      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [ACTOR, USER_A],
        {
          type: 'content_published',
          title: 'Published',
          message: 'Content published',
          actorId: ACTOR,
        },
      );

      expect(db.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: USER_A }),
        ]),
      );
      // Verify ACTOR is NOT in the values
      const valuesArg = insertChain.values.mock.calls[0][0] as Array<{ userId: string }>;
      expect(valuesArg.every((v) => v.userId !== ACTOR)).toBe(true);
    });
  });

  // =========================================================================
  // Create notification preserves resource link even when resource may be inaccessible
  // =========================================================================
  describe('notification preserves resource link for inaccessible resources', () => {
    it('create() stores resourceType and resourceId even when resource does not exist', async () => {
      const row = fakeNotificationRow({
        resourceType: 'branch',
        resourceId: DELETED_BRANCH_ID,
      });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'branch_archived',
        title: 'Branch Archived',
        message: 'A branch you followed has been archived',
        resourceType: 'branch',
        resourceId: DELETED_BRANCH_ID,
        actorId: ACTOR,
      });

      expect(result.resourceType).toBe('branch');
      expect(result.resourceId).toBe(DELETED_BRANCH_ID);
    });

    it('create() includes resource link in response even for user resource type', async () => {
      const deletedUserId = '00000000-0000-4000-a000-000000000088';
      const row = fakeNotificationRow({
        type: 'role_changed',
        category: 'lifecycle',
        title: 'Role Changed',
        message: 'Your role was changed',
        resourceType: 'user',
        resourceId: deletedUserId,
      });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'role_changed',
        title: 'Role Changed',
        message: 'Your role was changed',
        resourceType: 'user',
        resourceId: deletedUserId,
        actorId: ACTOR,
      });

      expect(result.resourceType).toBe('user');
      expect(result.resourceId).toBe(deletedUserId);
      // Notification is still fully formed even though the user resource may not be accessible
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Role Changed');
    });

    it('create() without resourceType/resourceId returns undefined for those fields', async () => {
      const row = fakeNotificationRow({
        resourceType: null,
        resourceId: null,
      });
      const insertChain = mockInsertChain([row]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      const result = await notificationService.create({
        userId: USER_A,
        type: 'review_requested',
        title: 'Review',
        message: 'Please review',
      });

      expect(result.resourceType).toBeUndefined();
      expect(result.resourceId).toBeUndefined();
    });
  });

  // =========================================================================
  // Multiple createBulk calls produce separate notifications (not batched)
  // =========================================================================
  describe('rapid state transitions produce separate notifications', () => {
    it('two sequential createBulk calls each trigger separate inserts', async () => {
      // After each createBulk insert, getUnreadCount fires (fire-and-forget) consuming a db.select.
      // Use a default fallback for those extra calls.
      const defaultSelect = mockSelectChain([{ count: 0 }]);

      // --- First call: collaborator_added ---
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockSelectChain([{ id: USER_A }])) // active users
        .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
        .mockReturnValue(defaultSelect); // fallback for getUnreadCount

      const insertChain1 = mockInsertChain([
        fakeNotificationRow({ userId: USER_A, type: 'collaborator_added', category: 'lifecycle' }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain1);

      await notificationService.createBulk(
        [USER_A],
        {
          type: 'collaborator_added',
          title: 'Added as Collaborator',
          message: 'You were added to branch X',
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: ACTOR,
        },
        { branchId: BRANCH_ID },
      );

      // --- Second call: collaborator_removed (rapid state change) ---
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockSelectChain([{ id: USER_A }])) // active users
        .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
        .mockReturnValue(defaultSelect); // fallback

      const insertChain2 = mockInsertChain([
        fakeNotificationRow({ userId: USER_A, type: 'collaborator_removed', category: 'lifecycle' }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain2);

      await notificationService.createBulk(
        [USER_A],
        {
          type: 'collaborator_removed',
          title: 'Removed as Collaborator',
          message: 'You were removed from branch X',
          resourceType: 'branch',
          resourceId: BRANCH_ID,
          actorId: ACTOR,
        },
        { branchId: BRANCH_ID },
      );

      // Verify two separate insert calls occurred
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('three rapid state transitions each produce three separate inserts', async () => {
      const types = ['review_requested', 'review_approved', 'content_published'] as const;
      const defaultSelect = mockSelectChain([{ count: 0 }]);

      for (const type of types) {
        (db.select as ReturnType<typeof vi.fn>)
          .mockReturnValueOnce(mockSelectChain([{ id: USER_A }])) // active users
          .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
          .mockReturnValue(defaultSelect); // fallback for getUnreadCount

        const insertChain = mockInsertChain([
          fakeNotificationRow({ userId: USER_A, type }),
        ]);
        (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

        await notificationService.createBulk(
          [USER_A],
          {
            type,
            title: `Notification: ${type}`,
            message: `Event: ${type}`,
            actorId: ACTOR,
          },
        );
      }

      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // createBulk with mixed active/deactivated users only inserts for active ones
  // =========================================================================
  describe('mixed active/deactivated users', () => {
    it('only inserts notifications for active users', async () => {
      // USER_A and USER_C are active; USER_B is deactivated
      const defaultSelect = mockSelectChain([{ count: 0 }]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockSelectChain([{ id: USER_A }, { id: USER_C }])) // active users
        .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
        .mockReturnValue(defaultSelect); // fallback for getUnreadCount

      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A }),
        fakeNotificationRow({ userId: USER_C }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [USER_A, USER_B, USER_C],
        {
          type: 'content_published',
          title: 'Published',
          message: 'Content published',
          actorId: ACTOR,
        },
      );

      expect(db.insert).toHaveBeenCalledTimes(1);
      // Verify values was called via the mock chain
      expect(insertChain.values).toHaveBeenCalled();
    });

    it('inserts for the single active user when rest are deactivated', async () => {
      const defaultSelect = mockSelectChain([{ count: 0 }]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockSelectChain([{ id: USER_B }])) // active users
        .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
        .mockReturnValue(defaultSelect); // fallback for getUnreadCount

      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_B }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [USER_A, USER_B, USER_C],
        {
          type: 'review_requested',
          title: 'Review needed',
          message: 'Please review',
          actorId: ACTOR,
        },
      );

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(insertChain.values).toHaveBeenCalled();
    });

    it('combines self-suppression and deactivation filtering correctly', async () => {
      const defaultSelect = mockSelectChain([{ count: 0 }]);

      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockSelectChain([{ id: USER_A }, { id: USER_C }])) // active users
        .mockReturnValueOnce(mockSelectChain([])) // disabled prefs
        .mockReturnValue(defaultSelect); // fallback for getUnreadCount

      const insertChain = mockInsertChain([
        fakeNotificationRow({ userId: USER_A }),
        fakeNotificationRow({ userId: USER_C }),
      ]);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

      await notificationService.createBulk(
        [ACTOR, USER_A, USER_B, USER_C],
        {
          type: 'branch_archived',
          title: 'Archived',
          message: 'Branch archived',
          actorId: ACTOR,
        },
      );

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(insertChain.values).toHaveBeenCalled();
    });
  });
});
