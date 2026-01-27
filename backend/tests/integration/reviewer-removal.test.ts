import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState, ReviewStatus } from '@echo-portal/shared';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
}));

// Mock database
vi.mock('../../src/db', () => {
  const mockReviews: any[] = [];
  const mockBranches: any[] = [];
  const mockUsers: any[] = [];
  const mockSessions: any[] = [];

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          return Promise.resolve([{ id: 'new-id' }]);
        }),
      }),
    }),
    select: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    query: {
      branches: {
        findFirst: vi.fn(),
      },
      reviews: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(),
      },
    },
  };

  return {
    db: mockDb,
    mockReviews,
    mockBranches,
    mockUsers,
    mockSessions,
  };
});

// Mock transition service
vi.mock('../../src/services/workflow/transitions', () => ({
  transitionService: {
    executeTransition: vi.fn().mockResolvedValue({
      id: 'transition-id',
      success: true,
    }),
  },
}));

import { db, mockBranches, mockUsers, mockReviews, mockSessions } from '../../src/db';
import { transitionService } from '../../src/services/workflow/transitions';
import { validateSession } from '../../src/services/auth/session';

describe('Reviewer Removal Tests (T060)', () => {
  // Use consistent UUIDs for testing
  const UUID_ADMIN = '00000000-0000-4000-8000-000000000001';
  const UUID_REVIEWER1 = '00000000-0000-4000-8000-000000000002';
  const UUID_REVIEWER2 = '00000000-0000-4000-8000-000000000003';
  const UUID_REVIEWER3 = '00000000-0000-4000-8000-000000000004';
  const UUID_OWNER = '00000000-0000-4000-8000-000000000005';
  const UUID_BRANCH_1 = '00000000-0000-4000-8000-000000000010';
  const UUID_BRANCH_2 = '00000000-0000-4000-8000-000000000011';
  const UUID_BRANCH_3 = '00000000-0000-4000-8000-000000000012';
  const UUID_REVIEW_1 = '00000000-0000-4000-8000-000000000020';
  const UUID_REVIEW_2 = '00000000-0000-4000-8000-000000000021';
  const UUID_REVIEW_3 = '00000000-0000-4000-8000-000000000022';

  const adminUser = {
    id: UUID_ADMIN,
    externalId: 'github-admin',
    provider: 'github',
    email: 'admin@example.com',
    displayName: 'Admin User',
    roles: ['administrator', 'reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const reviewer1 = {
    id: UUID_REVIEWER1,
    externalId: 'github-reviewer-1',
    provider: 'github',
    email: 'reviewer1@example.com',
    displayName: 'Reviewer One',
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const reviewer2 = {
    id: UUID_REVIEWER2,
    externalId: 'github-reviewer-2',
    provider: 'github',
    email: 'reviewer2@example.com',
    displayName: 'Reviewer Two',
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const reviewer3 = {
    id: UUID_REVIEWER3,
    externalId: 'github-reviewer-3',
    provider: 'github',
    email: 'reviewer3@example.com',
    displayName: 'Reviewer Three',
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const branchOwner = {
    id: UUID_OWNER,
    externalId: 'github-owner',
    provider: 'github',
    email: 'owner@example.com',
    displayName: 'Branch Owner',
    roles: ['contributor'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminSession = {
    id: 'session-admin',
    userId: UUID_ADMIN,
    token: 'admin-token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };

  const ownerSession = {
    id: 'session-owner',
    userId: UUID_OWNER,
    token: 'owner-token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBranches.length = 0;
    mockUsers.length = 0;
    mockReviews.length = 0;
    mockSessions.length = 0;

    // Setup default users
    mockUsers.push(adminUser, reviewer1, reviewer2, reviewer3, branchOwner);
    mockSessions.push(adminSession, ownerSession);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      if (token === 'admin-token') {
        return Promise.resolve({
          id: 'session-admin',
          userId: UUID_ADMIN,
          token: 'admin-token',
          role: 'administrator',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'owner-token') {
        return Promise.resolve({
          id: 'session-owner',
          userId: UUID_OWNER,
          token: 'owner-token',
          role: 'contributor',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      return Promise.resolve(null);
    });

    // Mock session lookup
    (db.query.sessions.findFirst as any).mockImplementation(({ where }: any) => {
      const session = mockSessions.find((s) => s.token === where);
      return Promise.resolve(session);
    });

    // Mock user lookup
    (db.query.users.findFirst as any).mockImplementation(({ where }: any) => {
      const user = mockUsers.find((u) => u.id === where);
      return Promise.resolve(user);
    });
  });

  describe('Remove Reviewer', () => {
    it('should successfully remove a reviewer from a branch', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_1,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([review]);

      // Mock branch update to remove reviewer
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [UUID_REVIEWER2] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.reviewers).toEqual([UUID_REVIEWER2]);

      // Verify review was deleted
      expect(db.delete).toHaveBeenCalled();
    });

    it('should cancel pending review when reviewer is removed', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_1,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([review]);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [] },
            ]),
          }),
        }),
      });

      // Mock review deletion
      const deleteMock = vi.fn().mockResolvedValue([review]);
      (db.delete as any).mockReturnValue({
        where: deleteMock,
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify review was deleted
      expect(db.delete).toHaveBeenCalled();
    });

    it('should NOT cancel completed reviews when reviewer is removed', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const completedReview = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_1,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(completedReview);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([completedReview]);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [UUID_REVIEWER2] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify review was NOT deleted (completed reviews are preserved)
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  describe('Last Reviewer Removed - Auto-Return to Draft (FR-017a)', () => {
    it('should automatically return branch to draft when last reviewer is removed', async () => {
      const branch = {
        id: UUID_BRANCH_2,
        name: 'test-branch-2',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1], // Only one reviewer
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_2,
        branchId: UUID_BRANCH_2,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([review]);

      // Mock branch update to empty reviewers
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_2}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify transition service was called to return to draft
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_2,
          event: 'CANCEL_REVIEW',
          actorId: UUID_OWNER,
          metadata: expect.objectContaining({
            reason: 'Last reviewer removed',
          }),
        })
      );
    });

    it('should NOT return to draft when removing a reviewer but others remain', async () => {
      const branch = {
        id: UUID_BRANCH_3,
        name: 'test-branch-3',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2, UUID_REVIEWER3],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_3,
        branchId: UUID_BRANCH_3,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([review]);

      // Mock branch update - still has 2 reviewers remaining
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [UUID_REVIEWER2, UUID_REVIEWER3] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_3}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Should NOT call transition service - other reviewers remain
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should delete all pending reviews when returning to draft', async () => {
      const branch = {
        id: UUID_BRANCH_2,
        name: 'test-branch-2',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pendingReview = {
        id: UUID_REVIEW_2,
        branchId: UUID_BRANCH_2,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(pendingReview);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([pendingReview]);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [] },
            ]),
          }),
        }),
      });

      // Mock review deletion
      const deleteMock = vi.fn().mockResolvedValue([pendingReview]);
      (db.delete as any).mockReturnValue({
        where: deleteMock,
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_2}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify pending reviews were deleted
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('Permissions', () => {
    it('should allow branch owner to remove reviewers', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([]);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);
    });

    it('should allow admin to remove reviewers', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findMany as any).mockResolvedValue([]);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when removing non-existent reviewer', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER2}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not a reviewer');
    });

    it('should return 404 when branch does not exist', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(null);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Branch not found');
    });
  });
});
