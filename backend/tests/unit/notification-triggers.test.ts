import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so NO outer-scope variable references
// ---------------------------------------------------------------------------

vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Imports — AFTER all vi.mock calls so hoisting resolves correctly
// ---------------------------------------------------------------------------

import { notificationService } from '../../src/services/notification/notification-service';
import {
  notifyCollaboratorAdded,
  notifyCollaboratorRemoved,
  notifyContentPublished,
  notifyBranchArchived,
  notifyRoleChanged,
  notifyAIComplianceError,
} from '../../src/services/notification/notification-triggers';

// ---------------------------------------------------------------------------
// Test IDs — valid UUID format
// ---------------------------------------------------------------------------

const USER_A = '00000000-0000-4000-a000-000000000001';
const USER_B = '00000000-0000-4000-a000-000000000002';
const USER_C = '00000000-0000-4000-a000-000000000003';
const ACTOR = '00000000-0000-4000-a000-000000000099';
const BRANCH_ID = '00000000-0000-4000-b000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flush the microtask queue so fire-and-forget promises (the `.catch()` chains
 * inside each trigger function) resolve before we inspect the mock.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notification-triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default resolved behaviour
    (notificationService.createBulk as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  // =========================================================================
  // notifyCollaboratorAdded
  // =========================================================================
  describe('notifyCollaboratorAdded()', () => {
    it('calls createBulk with the collaboratorId as sole recipient', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A],
        expect.objectContaining({
          type: 'collaborator_added',
          title: 'Added as Collaborator',
        }),
        { branchId: BRANCH_ID },
      );
    });

    it('passes category lifecycle', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ category: 'lifecycle' }),
        expect.any(Object),
      );
    });

    it('passes the correct actorId', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ actorId: ACTOR }),
        expect.any(Object),
      );
    });

    it('passes branchId in options', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        { branchId: BRANCH_ID },
      );
    });

    it('includes branch name in the message', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'Feature X', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: 'You have been added as a collaborator on "Feature X"',
        }),
        expect.any(Object),
      );
    });

    it('sets resourceType to branch and resourceId to branchId', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          resourceType: 'branch',
          resourceId: BRANCH_ID,
        }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // notifyCollaboratorRemoved
  // =========================================================================
  describe('notifyCollaboratorRemoved()', () => {
    it('calls createBulk with the collaboratorId as sole recipient', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_B],
        expect.objectContaining({
          type: 'collaborator_removed',
          title: 'Removed as Collaborator',
        }),
        { branchId: BRANCH_ID },
      );
    });

    it('passes category lifecycle', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ category: 'lifecycle' }),
        expect.any(Object),
      );
    });

    it('passes the correct actorId', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ actorId: ACTOR }),
        expect.any(Object),
      );
    });

    it('passes branchId in options', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        { branchId: BRANCH_ID },
      );
    });

    it('includes branch name in the message', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'Release Y', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: 'You have been removed as a collaborator from "Release Y"',
        }),
        expect.any(Object),
      );
    });

    it('sets resourceType to branch and resourceId to branchId', async () => {
      notifyCollaboratorRemoved(BRANCH_ID, USER_B, 'My Branch', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          resourceType: 'branch',
          resourceId: BRANCH_ID,
        }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // notifyContentPublished
  // =========================================================================
  describe('notifyContentPublished()', () => {
    it('calls createBulk with the full recipientIds array', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A, USER_B, USER_C], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A, USER_B, USER_C],
        expect.objectContaining({
          type: 'content_published',
          title: 'Content Published',
        }),
        { branchId: BRANCH_ID },
      );
    });

    it('accepts an array of recipientIds (multiple recipients)', async () => {
      const recipients = [USER_A, USER_B];
      notifyContentPublished(BRANCH_ID, 'My Branch', recipients, ACTOR);
      await flushPromises();

      const call = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toEqual(recipients);
      expect(call[0]).toHaveLength(2);
    });

    it('accepts a single-element recipientIds array', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A], ACTOR);
      await flushPromises();

      const call = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toEqual([USER_A]);
    });

    it('passes category lifecycle', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ category: 'lifecycle' }),
        expect.any(Object),
      );
    });

    it('passes the correct actorId', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ actorId: ACTOR }),
        expect.any(Object),
      );
    });

    it('passes branchId in options', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        { branchId: BRANCH_ID },
      );
    });

    it('includes branch name in the message', async () => {
      notifyContentPublished(BRANCH_ID, 'Homepage v2', [USER_A], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: '"Homepage v2" has been published',
        }),
        expect.any(Object),
      );
    });

    it('sets resourceType to branch and resourceId to branchId', async () => {
      notifyContentPublished(BRANCH_ID, 'My Branch', [USER_A], ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          resourceType: 'branch',
          resourceId: BRANCH_ID,
        }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // notifyBranchArchived
  // =========================================================================
  describe('notifyBranchArchived()', () => {
    it('calls createBulk with the ownerId as sole recipient', async () => {
      notifyBranchArchived(BRANCH_ID, 'Old Branch', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A],
        expect.objectContaining({
          type: 'branch_archived',
          title: 'Branch Archived',
        }),
        { branchId: BRANCH_ID },
      );
    });

    it('passes category lifecycle', async () => {
      notifyBranchArchived(BRANCH_ID, 'Old Branch', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ category: 'lifecycle' }),
        expect.any(Object),
      );
    });

    it('passes the correct actorId', async () => {
      notifyBranchArchived(BRANCH_ID, 'Old Branch', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ actorId: ACTOR }),
        expect.any(Object),
      );
    });

    it('passes branchId in options', async () => {
      notifyBranchArchived(BRANCH_ID, 'Old Branch', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        { branchId: BRANCH_ID },
      );
    });

    it('includes branch name in the message', async () => {
      notifyBranchArchived(BRANCH_ID, 'Deprecated Content', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: '"Deprecated Content" has been archived',
        }),
        expect.any(Object),
      );
    });

    it('sets resourceType to branch and resourceId to branchId', async () => {
      notifyBranchArchived(BRANCH_ID, 'Old Branch', USER_A, ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          resourceType: 'branch',
          resourceId: BRANCH_ID,
        }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // notifyRoleChanged
  // =========================================================================
  describe('notifyRoleChanged()', () => {
    it('calls createBulk with the userId as sole recipient', async () => {
      notifyRoleChanged(USER_A, 'editor', 'administrator', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(1);
      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A],
        expect.objectContaining({
          type: 'role_changed',
          title: 'Role Changed',
        }),
      );
    });

    it('passes category lifecycle', async () => {
      notifyRoleChanged(USER_A, 'editor', 'administrator', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ category: 'lifecycle' }),
      );
    });

    it('passes the correct actorId', async () => {
      notifyRoleChanged(USER_A, 'editor', 'administrator', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ actorId: ACTOR }),
      );
    });

    it('includes old and new role in the message', async () => {
      notifyRoleChanged(USER_A, 'viewer', 'editor', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: 'Your role has been changed from viewer to editor',
        }),
      );
    });

    it('includes different old and new roles correctly', async () => {
      notifyRoleChanged(USER_A, 'administrator', 'viewer', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: 'Your role has been changed from administrator to viewer',
        }),
      );
    });

    it('sets resourceType to user and resourceId to userId', async () => {
      notifyRoleChanged(USER_A, 'editor', 'administrator', ACTOR);
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          resourceType: 'user',
          resourceId: USER_A,
        }),
      );
    });

    it('does not pass branchId in options (no third argument)', async () => {
      notifyRoleChanged(USER_A, 'editor', 'administrator', ACTOR);
      await flushPromises();

      // notifyRoleChanged only passes 2 args to createBulk (no options object)
      const call = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call).toHaveLength(2);
    });
  });

  // =========================================================================
  // notifyAIComplianceError
  // =========================================================================
  describe('notifyAIComplianceError', () => {
    it('calls createBulk with type ai_compliance_error and category ai', async () => {
      notifyAIComplianceError(BRANCH_ID, 'My Branch', [USER_A], ACTOR, 'Image violates policy');
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A],
        expect.objectContaining({
          type: 'ai_compliance_error',
          category: 'ai',
          title: 'AI Compliance Issue Detected',
          actorId: ACTOR,
          resourceType: 'branch',
          resourceId: BRANCH_ID,
        }),
        { branchId: BRANCH_ID },
      );
    });

    it('includes branch name and finding summary in message', async () => {
      notifyAIComplianceError(BRANCH_ID, 'Test Branch', [USER_A], ACTOR, 'Inappropriate content detected');
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          message: 'Compliance issue found on "Test Branch": Inappropriate content detected',
        }),
        expect.any(Object),
      );
    });

    it('truncates finding summary to 100 characters in message', async () => {
      const longSummary = 'A'.repeat(150);
      notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A], ACTOR, longSummary);
      await flushPromises();

      const call = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      const message = call[1].message as string;
      // The summary is sliced to 100 chars, so message should contain A×100 not A×150
      expect(message).toContain('A'.repeat(100));
      expect(message).not.toContain('A'.repeat(101));
    });

    it('sends to multiple recipients', async () => {
      notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A, USER_B], ACTOR, 'Issue found');
      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledWith(
        [USER_A, USER_B],
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('passes branchId in options for visibility filtering', async () => {
      notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A], ACTOR, 'Issue');
      await flushPromises();

      const call = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[2]).toEqual({ branchId: BRANCH_ID });
    });

    it('returns void (fire-and-forget)', () => {
      const result = notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A], ACTOR, 'Issue');
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Fire-and-forget: errors don't propagate
  // =========================================================================
  describe('fire-and-forget error handling', () => {
    it('notifyCollaboratorAdded does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      // Should not throw
      expect(() => notifyCollaboratorAdded(BRANCH_ID, USER_A, 'Branch', ACTOR)).not.toThrow();
      await flushPromises();
    });

    it('notifyCollaboratorRemoved does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      expect(() => notifyCollaboratorRemoved(BRANCH_ID, USER_A, 'Branch', ACTOR)).not.toThrow();
      await flushPromises();
    });

    it('notifyContentPublished does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      expect(() => notifyContentPublished(BRANCH_ID, 'Branch', [USER_A], ACTOR)).not.toThrow();
      await flushPromises();
    });

    it('notifyBranchArchived does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      expect(() => notifyBranchArchived(BRANCH_ID, 'Branch', USER_A, ACTOR)).not.toThrow();
      await flushPromises();
    });

    it('notifyRoleChanged does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      expect(() => notifyRoleChanged(USER_A, 'editor', 'admin', ACTOR)).not.toThrow();
      await flushPromises();
    });

    it('notifyAIComplianceError does not throw when createBulk rejects', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );

      expect(() => notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A], ACTOR, 'Issue')).not.toThrow();
      await flushPromises();
    });

    it('rejection does not cause unhandled promise rejection', async () => {
      (notificationService.createBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );

      const unhandledHandler = vi.fn();
      process.on('unhandledRejection', unhandledHandler);

      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'Branch', ACTOR);
      notifyCollaboratorRemoved(BRANCH_ID, USER_A, 'Branch', ACTOR);
      notifyContentPublished(BRANCH_ID, 'Branch', [USER_A], ACTOR);
      notifyBranchArchived(BRANCH_ID, 'Branch', USER_A, ACTOR);
      notifyRoleChanged(USER_A, 'editor', 'admin', ACTOR);
      notifyAIComplianceError(BRANCH_ID, 'Branch', [USER_A], ACTOR, 'Issue');

      await flushPromises();

      expect(unhandledHandler).not.toHaveBeenCalled();
      process.removeListener('unhandledRejection', unhandledHandler);
    });
  });

  // =========================================================================
  // All 5 lifecycle triggers pass category: 'lifecycle'
  // =========================================================================
  describe('all lifecycle triggers pass category lifecycle', () => {
    it('every lifecycle trigger function sets category to lifecycle', async () => {
      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'B1', ACTOR);
      notifyCollaboratorRemoved(BRANCH_ID, USER_A, 'B2', ACTOR);
      notifyContentPublished(BRANCH_ID, 'B3', [USER_A], ACTOR);
      notifyBranchArchived(BRANCH_ID, 'B4', USER_A, ACTOR);
      notifyRoleChanged(USER_A, 'editor', 'admin', ACTOR);

      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(5);

      const calls = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[1]).toEqual(expect.objectContaining({ category: 'lifecycle' }));
      }
    });
  });

  // =========================================================================
  // All 6 triggers pass correct actorId
  // =========================================================================
  describe('all triggers pass correct actorId', () => {
    it('every trigger function forwards the actorId argument', async () => {
      const differentActor = '00000000-0000-4000-a000-000000000077';

      notifyCollaboratorAdded(BRANCH_ID, USER_A, 'B1', differentActor);
      notifyCollaboratorRemoved(BRANCH_ID, USER_A, 'B2', differentActor);
      notifyContentPublished(BRANCH_ID, 'B3', [USER_A], differentActor);
      notifyBranchArchived(BRANCH_ID, 'B4', USER_A, differentActor);
      notifyRoleChanged(USER_A, 'editor', 'admin', differentActor);
      notifyAIComplianceError(BRANCH_ID, 'B6', [USER_A], differentActor, 'Issue');

      await flushPromises();

      expect(notificationService.createBulk).toHaveBeenCalledTimes(6);

      const calls = (notificationService.createBulk as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[1]).toEqual(expect.objectContaining({ actorId: differentActor }));
      }
    });
  });

  // =========================================================================
  // Return type: all functions return void
  // =========================================================================
  describe('return type', () => {
    it('all trigger functions return void (undefined)', () => {
      const r1 = notifyCollaboratorAdded(BRANCH_ID, USER_A, 'B', ACTOR);
      const r2 = notifyCollaboratorRemoved(BRANCH_ID, USER_A, 'B', ACTOR);
      const r3 = notifyContentPublished(BRANCH_ID, 'B', [USER_A], ACTOR);
      const r4 = notifyBranchArchived(BRANCH_ID, 'B', USER_A, ACTOR);
      const r5 = notifyRoleChanged(USER_A, 'editor', 'admin', ACTOR);
      const r6 = notifyAIComplianceError(BRANCH_ID, 'B', [USER_A], ACTOR, 'Issue');

      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
      expect(r3).toBeUndefined();
      expect(r4).toBeUndefined();
      expect(r5).toBeUndefined();
      expect(r6).toBeUndefined();
    });
  });
});
