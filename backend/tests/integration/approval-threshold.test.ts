import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState, ReviewStatus } from '@echo-portal/shared';
import { randomUUID } from 'crypto';

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
          // Return appropriate mock data based on table
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

// Mock content services used by checkBranchHasContent helper in the route
vi.mock('../../src/services/content/content-service', () => ({
  contentService: {
    listByBranch: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../../src/services/content/content-inheritance-service', () => ({
  contentInheritanceService: {
    computeBranchDiff: vi.fn().mockResolvedValue({ hasChanges: false, added: [], modified: [], removed: [] }),
  },
}));

// Mock branch service so approval-threshold route handler
// bypasses the branchService.update() draft-only / ownership checks
vi.mock('../../src/services/branch/branch-service', () => {
  const _mockBranchServiceState: { getByIdResult: any; updateResult: any } = {
    getByIdResult: null,
    updateResult: null,
  };

  const makeBranchLike = (data: any) => ({
    ...data,
    toJSON: () => data,
    toResponseForUser: () => data,
  });

  return {
    branchService: {
      getById: vi.fn().mockImplementation(() => {
        const result = _mockBranchServiceState.getByIdResult;
        return Promise.resolve(result ? makeBranchLike(result) : null);
      }),
      update: vi.fn().mockImplementation(() => {
        const result = _mockBranchServiceState.updateResult;
        return Promise.resolve(result ? makeBranchLike(result) : null);
      }),
      // Provide other methods as pass-throughs so other routes don't break
      create: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      addReviewers: vi.fn(),
      removeReviewer: vi.fn(),
      getByOwner: vi.fn(),
      getByReviewer: vi.fn(),
      updateHeadCommit: vi.fn(),
    },
    _mockBranchServiceState,
  };
});

import { db, mockBranches, mockUsers, mockReviews, mockSessions } from '../../src/db';
import { transitionService } from '../../src/services/workflow/transitions';
import { validateSession } from '../../src/services/auth/session';
import { branchService, _mockBranchServiceState } from '../../src/services/branch/branch-service';

describe('Approval Threshold Tests (T058)', () => {
  let _currentAuthUser: any = null;

  // Use consistent UUIDs for testing
  const UUID_ADMIN = '00000000-0000-4000-8000-000000000001';
  const UUID_REVIEWER1 = '00000000-0000-4000-8000-000000000002';
  const UUID_REVIEWER2 = '00000000-0000-4000-8000-000000000003';
  const UUID_OWNER = '00000000-0000-4000-8000-000000000004';
  const UUID_BRANCH_1 = '00000000-0000-4000-8000-000000000010';
  const UUID_BRANCH_2 = '00000000-0000-4000-8000-000000000011';
  const UUID_BRANCH_3 = '00000000-0000-4000-8000-000000000012';
  const UUID_BRANCH_4 = '00000000-0000-4000-8000-000000000013';
  const UUID_BRANCH_5 = '00000000-0000-4000-8000-000000000014';
  const UUID_BRANCH_6 = '00000000-0000-4000-8000-000000000015';
  const UUID_BRANCH_7 = '00000000-0000-4000-8000-000000000016';
  const UUID_BRANCH_8 = '00000000-0000-4000-8000-000000000017';
  const UUID_BRANCH_9 = '00000000-0000-4000-8000-000000000018';
  const UUID_REVIEW_1 = '00000000-0000-4000-8000-000000000020';
  const UUID_REVIEW_2 = '00000000-0000-4000-8000-000000000021';
  const UUID_REVIEW_61 = '00000000-0000-4000-8000-000000000026';
  const UUID_REVIEW_71 = '00000000-0000-4000-8000-000000000027';
  const UUID_REVIEW_72 = '00000000-0000-4000-8000-000000000028';
  const UUID_REVIEW_81 = '00000000-0000-4000-8000-000000000029';
  const UUID_REVIEW_82 = '00000000-0000-4000-8000-000000000030';
  const UUID_REVIEW_91 = '00000000-0000-4000-8000-000000000031';
  const UUID_REVIEW_92 = '00000000-0000-4000-8000-000000000032';

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockBranches.length = 0;
    mockUsers.length = 0;
    mockReviews.length = 0;
    mockSessions.length = 0;
    _mockBranchServiceState.getByIdResult = null;
    _mockBranchServiceState.updateResult = null;

    // Setup default users
    mockUsers.push(adminUser, reviewer1, reviewer2, branchOwner);
    mockSessions.push(adminSession, reviewer1Session, reviewer2Session);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      if (token === 'admin-token') {
        _currentAuthUser = adminUser;
        return Promise.resolve({
          id: 'session-admin',
          userId: UUID_ADMIN,
          token: 'admin-token',
          role: 'administrator',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'reviewer-1-token') {
        _currentAuthUser = reviewer1;
        return Promise.resolve({
          id: 'session-reviewer-1',
          userId: UUID_REVIEWER1,
          token: 'reviewer-1-token',
          role: 'reviewer',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'reviewer-2-token') {
        _currentAuthUser = reviewer2;
        return Promise.resolve({
          id: 'session-reviewer-2',
          userId: UUID_REVIEWER2,
          token: 'reviewer-2-token',
          role: 'reviewer',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'contributor-token') {
        _currentAuthUser = branchOwner;
        return Promise.resolve({
          id: 'session-contributor',
          userId: UUID_OWNER,
          token: 'contributor-token',
          role: 'contributor',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      _currentAuthUser = null;
      return Promise.resolve(null);
    });

    // Setup db.select to handle auth middleware user lookup
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            return Promise.resolve(_currentAuthUser ? [_currentAuthUser] : []);
          }),
        }),
      }),
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

  describe('Default Threshold Behavior (requiredApprovals = 1)', () => {
    it('should transition to approved after single approval when threshold is 1', async () => {
      const branch = {
        id: UUID_BRANCH_1,
        name: 'test-branch',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1, // Default
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

      // Mock branch lookup
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // Mock review lookup
      (db.query.reviews.findFirst as any).mockResolvedValue(review);

      // Mock review stats to show 1 approval after this review
      (db.query.reviews.findMany as any).mockResolvedValue([
        { ...review, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      // Mock review update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      // Approve the review
      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({ reason: 'Looks good' }),
      });

      if (response.status !== 200) {
        const error = await response.json();
        console.log('Error response:', JSON.stringify(error, null, 2));
      }

      expect(response.status).toBe(200);

      // Verify transition service was called to approve the branch
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_1,
          event: 'APPROVE',
          actorId: UUID_REVIEWER1,
          metadata: expect.objectContaining({
            approvalCount: 1,
            requiredApprovals: 1,
          }),
        })
      );
    });

    it('should use default threshold of 1 when requiredApprovals is not set', async () => {
      const branch = {
        id: UUID_BRANCH_2,
        name: 'test-branch-2',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: null, // Not explicitly set
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

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_2}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Should default to 1 approval required
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            approvalCount: 1,
            requiredApprovals: 1,
          }),
        })
      );
    });
  });

  describe('Per-Branch Threshold Configuration', () => {
    it('should allow admin to configure approval threshold', async () => {
      const branch = {
        id: UUID_BRANCH_3,
        name: 'test-branch-3',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);

      // Setup branchService mock to return branch data
      _mockBranchServiceState.getByIdResult = branch;
      _mockBranchServiceState.updateResult = { ...branch, requiredApprovals: 3 };

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_3}/approval-threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ requiredApprovals: 3 }),
      });

      if (response.status !== 200) {
        const error = await response.json();
        console.log('Admin threshold config error:', JSON.stringify(error, null, 2));
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.requiredApprovals).toBe(3);
    });

    it('should deny non-admin from configuring approval threshold', async () => {
      const branch = {
        id: UUID_BRANCH_4,
        name: 'test-branch-4',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);

      // Mock non-admin user
      const contributorSession = {
        id: 'session-contributor',
        userId: UUID_OWNER,
        token: 'contributor-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };
      mockSessions.push(contributorSession);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_4}/approval-threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer contributor-token',
        },
        body: JSON.stringify({ requiredApprovals: 2 }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Only administrators can configure approval thresholds');
    });

    it('should validate threshold range (1-10)', async () => {
      const branch = {
        id: UUID_BRANCH_5,
        name: 'test-branch-5',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // Try to set threshold to 0
      const response1 = await app.request(`/api/v1/branches/${UUID_BRANCH_5}/approval-threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ requiredApprovals: 0 }),
      });

      expect(response1.status).toBe(400);

      // Try to set threshold to 11
      const response2 = await app.request(`/api/v1/branches/${UUID_BRANCH_5}/approval-threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ requiredApprovals: 11 }),
      });

      expect(response2.status).toBe(400);
    });
  });

  describe('Multi-Approval Threshold', () => {
    it('should NOT transition to approved when threshold not met (2 required, 1 approved)', async () => {
      const branch = {
        id: UUID_BRANCH_6,
        name: 'test-branch-6',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 2, // Requires 2 approvals
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review1 = {
        id: UUID_REVIEW_61,
        branchId: UUID_BRANCH_6,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review1);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review1);

      // Only 1 approval so far
      (db.query.reviews.findMany as any).mockResolvedValue([
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

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_61}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-1-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Should NOT call transition service because threshold not met
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should transition to approved when threshold is met (2 required, 2 approved)', async () => {
      const branch = {
        id: UUID_BRANCH_7,
        name: 'test-branch-7',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 2,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review1 = {
        id: UUID_REVIEW_71,
        branchId: UUID_BRANCH_7,
        reviewerId: UUID_REVIEWER1,
        requestedById: UUID_OWNER,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review2 = {
        id: UUID_REVIEW_72,
        branchId: UUID_BRANCH_7,
        reviewerId: UUID_REVIEWER2,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review1, review2);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review2);

      // 2 approvals after this one
      (db.query.reviews.findMany as any).mockResolvedValue([
        review1,
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

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_72}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Should call transition service because threshold is met
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_7,
          event: 'APPROVE',
          metadata: expect.objectContaining({
            approvalCount: 2,
            requiredApprovals: 2,
          }),
        })
      );
    });

    it('should accumulate approvals across multiple reviewers', async () => {
      const branch = {
        id: UUID_BRANCH_8,
        name: 'test-branch-8',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 3,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First approval
      const review1 = {
        id: UUID_REVIEW_81,
        branchId: UUID_BRANCH_8,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Second approval (current)
      const review2 = {
        id: UUID_REVIEW_82,
        branchId: UUID_BRANCH_8,
        reviewerId: UUID_REVIEWER2,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review1, review2);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review2);

      // 2 approvals so far (threshold requires 3)
      (db.query.reviews.findMany as any).mockResolvedValue([
        review1,
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

      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_82}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Should NOT transition because only 2/3 approvals
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });
  });

  describe('Request Changes with Threshold', () => {
    it('should reset approval progress when changes are requested', async () => {
      const branch = {
        id: UUID_BRANCH_9,
        name: 'test-branch-9',
        userId: UUID_OWNER,
        state: BranchState.REVIEW,
        requiredApprovals: 2,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review1 = {
        id: UUID_REVIEW_91,
        branchId: UUID_BRANCH_9,
        reviewerId: UUID_REVIEWER1,
        status: ReviewStatus.COMPLETED,
        decision: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review2 = {
        id: UUID_REVIEW_92,
        branchId: UUID_BRANCH_9,
        reviewerId: UUID_REVIEWER2,
        requestedById: UUID_OWNER,
        status: ReviewStatus.PENDING,
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockReviews.push(review1, review2);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.reviews.findFirst as any).mockResolvedValue(review2);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...review2, status: ReviewStatus.COMPLETED, decision: 'changes_requested' },
            ]),
          }),
        }),
      });

      // Request changes
      const response = await app.request(`/api/v1/reviews/${UUID_REVIEW_92}/request-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-2-token',
        },
        body: JSON.stringify({ reason: 'Need to fix bugs' }),
      });

      expect(response.status).toBe(200);

      // Should call transition to return to draft (resets approvals)
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH_9,
          event: 'REQUEST_CHANGES',
          reason: 'Need to fix bugs',
        })
      );
    });
  });
});
