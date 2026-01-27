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
    delete: vi.fn(),
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

describe('Review State Transition Tests (T059)', () => {
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
  const UUID_REVIEW_31 = '00000000-0000-4000-8000-000000000031';
  const UUID_REVIEW_32 = '00000000-0000-4000-8000-000000000032';
  const UUID_REVIEW_33 = '00000000-0000-4000-8000-000000000033';

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

  const reviewer1Session = {
    id: 'session-reviewer-1',
    userId: UUID_REVIEWER1,
    token: 'reviewer-1-token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };

  const reviewer2Session = {
    id: 'session-reviewer-2',
    userId: UUID_REVIEWER2,
    token: 'reviewer-2-token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };

  const reviewer3Session = {
    id: 'session-reviewer-3',
    userId: UUID_REVIEWER3,
    token: 'reviewer-3-token',
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
    mockSessions.push(reviewer1Session, reviewer2Session, reviewer3Session);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      if (token === 'reviewer-1-token') {
        return Promise.resolve({
          id: 'session-reviewer-1',
          userId: UUID_REVIEWER1,
          token: 'reviewer-1-token',
          role: 'reviewer',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'reviewer-2-token') {
        return Promise.resolve({
          id: 'session-reviewer-2',
          userId: UUID_REVIEWER2,
          token: 'reviewer-2-token',
          role: 'reviewer',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'reviewer-3-token') {
        return Promise.resolve({
          id: 'session-reviewer-3',
          userId: UUID_REVIEWER3,
          token: 'reviewer-3-token',
          role: 'reviewer',
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

  describe('Approve Transition', () => {
    it('should successfully transition review from pending to approved', async () => {
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
      (db.query.reviews.findFirst as any).mockResolvedValue(review);
      (db.query.reviews.findMany as any).mockResolvedValue([
        { ...review, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({ reason: 'LGTM' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe(ReviewStatus.COMPLETED);
      expect(data.decision).toBe('approved');

      // Verify transition was called
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_1,
          event: 'APPROVE',
          actorId: UUID_REVIEWER1,
        })
      );
    });

    it('should record approval reason in review', async () => {
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
      (db.query.reviews.findFirst as any).mockResolvedValue(review);
      (db.query.reviews.findMany as any).mockResolvedValue([
        { ...review, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      const updateMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { ...review, status: ReviewStatus.COMPLETED, decision: 'approved', reason: 'Code looks good' },
        ]),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateMock,
        }),
      });

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({ reason: 'Code looks good' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Request Changes Transition', () => {
    it('should transition branch back to draft when changes are requested', async () => {
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
      (db.query.reviews.findFirst as any).mockResolvedValue(review);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review, status: ReviewStatus.COMPLETED, decision: 'changes_requested' },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_2}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({ reason: 'Please fix the bug' }),
      });

      expect(response.status).toBe(200);

      // Verify transition was called to return to draft
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_2,
          event: 'REQUEST_CHANGES',
          actorId: UUID_REVIEWER1,
          reason: 'Please fix the bug',
        })
      );
    });

    it('should invalidate existing approvals when changes are requested', async () => {
      const branch = {
        id: UUID_BRANCH_2,
        name: 'test-branch-2',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 2,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingApproval = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_2,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_2,
        branchId: UUID_BRANCH_2,
        reviewerId: UUID_REVIEWER2,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(existingApproval, review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review, status: ReviewStatus.COMPLETED, decision: 'changes_requested' },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_2}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({ reason: 'Security issue found' }),
      });

      expect(response.status).toBe(200);

      // When returning to draft, existing approvals are invalidated
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'REQUEST_CHANGES',
          reason: 'Security issue found',
        })
      );
    });
  });

  describe('Concurrent Approval Handling', () => {
    it('should handle multiple reviewers approving concurrently', async () => {
      const branch = {
        id: UUID_BRANCH_3,
        name: 'test-branch-3',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 3,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2, UUID_REVIEWER3],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review1 = {
        id: UUID_REVIEW_31,
        branchId: UUID_BRANCH_3,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review2 = {
        id: UUID_REVIEW_32,
        branchId: UUID_BRANCH_3,
        reviewerId: UUID_REVIEWER2,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review3 = {
        id: UUID_REVIEW_33,
        branchId: UUID_BRANCH_3,
        reviewerId: UUID_REVIEWER3,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review1, review2, review3);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // First approval
      (db.query.reviews.findFirst as any).mockResolvedValueOnce(review1);
      (db.query.reviews.findMany as any).mockResolvedValueOnce([
        { ...review1, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review1, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      const response1 = await app.request(`/api/v1/reviews/${UUID_REVIEW_31}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({}),
      });

      expect(response1.status).toBe(200);
      // Should not transition to approved yet (1/3)
      expect(transitionService.executeTransition).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Second approval
      (db.query.reviews.findFirst as any).mockResolvedValueOnce(review2);
      (db.query.reviews.findMany as any).mockResolvedValueOnce([
        { ...review1, status: ReviewStatus.COMPLETED, decision: 'approved' },
        { ...review2, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review2, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      const response2 = await app.request(`/api/v1/reviews/${UUID_REVIEW_32}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({}),
      });

      expect(response2.status).toBe(200);
      // Should not transition to approved yet (2/3)
      expect(transitionService.executeTransition).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Third approval - threshold met
      (db.query.reviews.findFirst as any).mockResolvedValueOnce(review3);
      (db.query.reviews.findMany as any).mockResolvedValueOnce([
        { ...review1, status: ReviewStatus.COMPLETED, decision: 'approved' },
        { ...review2, status: ReviewStatus.COMPLETED, decision: 'approved' },
        { ...review3, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review3, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      const response3 = await app.request(`/api/v1/reviews/${UUID_REVIEW_33}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-3-token',
        },
        body: JSON.stringify({}),
      });

      expect(response3.status).toBe(200);
      // Now threshold is met (3/3)
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'APPROVE',
          metadata: expect.objectContaining({
            approvalCount: 3,
            requiredApprovals: 3,
          }),
        })
      );
    });

    it('should prevent double-approval by same reviewer', async () => {
      const branch = {
        id: UUID_BRANCH_3,
        name: 'test-branch-3',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_31,
        branchId: UUID_BRANCH_3,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review);

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_31}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({}),
      });

      // Should reject - review already completed
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already completed');
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should reject approval when branch is not in REVIEW state', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.DRAFT, // Not in REVIEW
        requiredApprovals: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_1,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review);

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('not in review state');
    });

    it('should reject approval from non-assigned reviewer', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch-1',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        reviewers: [UUID_REVIEWER1], // Only reviewer1 assigned
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = {
        id: UUID_REVIEW_1,
        branchId: UUID_BRANCH_1,
        reviewerId: UUID_REVIEWER2, // But review2 is trying
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(null); // No review found

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(404);
    });
  });
});
