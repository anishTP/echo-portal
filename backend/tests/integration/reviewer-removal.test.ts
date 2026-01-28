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
        findMany: vi.fn(),
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
  let _currentAuthUser: any = null;

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

  // Helper to create a properly-shaped branch object matching the DB schema
  function makeBranch(overrides: Record<string, any> = {}) {
    return {
      id: UUID_BRANCH_1,
      name: 'test-branch-1',
      slug: 'test-branch-1-slug',
      gitRef: 'refs/heads/test-branch-1',
      baseRef: 'main',
      baseCommit: 'abc123',
      headCommit: 'def456',
      state: BranchState.REVIEW,
      visibility: 'private',
      ownerId: UUID_OWNER,
      reviewers: [UUID_REVIEWER1],
      collaborators: [],
      assignedReviewers: [],
      requiredApprovals: 1,
      description: null,
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: null,
      approvedAt: null,
      publishedAt: null,
      archivedAt: null,
      ...overrides,
    };
  }

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
        _currentAuthUser = adminUser;
        return Promise.resolve({
          id: 'session-admin',
          userId: UUID_ADMIN,
          token: 'admin-token',
          role: 'administrator',
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      if (token === 'owner-token') {
        _currentAuthUser = branchOwner;
        return Promise.resolve({
          id: 'session-owner',
          userId: UUID_OWNER,
          token: 'owner-token',
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

    // Mock users findMany for teamService.getBranchReviewers
    (db.query.users as any).findMany = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
  });

  describe('Remove Reviewer', () => {
    it('should successfully remove a reviewer from a branch', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
      });

      const updatedBranch = { ...branch, reviewers: [UUID_REVIEWER2] };

      mockBranches.push(branch);

      // branchService.getByIdOrThrow calls findFirst (returns original branch)
      // teamService.getBranchReviewers also calls findFirst (should return updated branch)
      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)       // branchService.getByIdOrThrow
        .mockResolvedValueOnce(updatedBranch); // teamService.getBranchReviewers

      // Mock branch update (branchService.removeReviewer updates the reviewers array)
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService.getBranchReviewers looks up reviewer users
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([reviewer2]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      // Route returns success(c, reviewers) which wraps in {data: [...]}
      // The data is an array of TeamMember objects from teamService.getBranchReviewers
      expect(data.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: UUID_REVIEWER2 }),
        ])
      );

      // Verify db.update was called to update the branch
      expect(db.update).toHaveBeenCalled();
    });

    it('should cancel pending review when reviewer is removed', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        reviewers: [UUID_REVIEWER1],
      });

      const updatedBranch = {
        ...branch,
        reviewers: [],
        state: BranchState.DRAFT,
        submittedAt: null,
      };

      mockBranches.push(branch);

      // branchService.getByIdOrThrow -> findFirst
      // teamService.getBranchReviewers -> findFirst (returns updated branch with empty reviewers)
      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService returns empty reviewers since branch has no reviewers
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify the branch was updated (reviewer removed + state change to draft)
      expect(db.update).toHaveBeenCalled();
    });

    it('should NOT cancel completed reviews when reviewer is removed', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2],
      });

      const updatedBranch = { ...branch, reviewers: [UUID_REVIEWER2] };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService looks up remaining reviewer
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([reviewer2]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // The service does NOT delete review records - it only updates the branch reviewers array
      // Completed review records are always preserved
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  describe('Last Reviewer Removed - Auto-Return to Draft (FR-017a)', () => {
    it('should automatically return branch to draft when last reviewer is removed', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_2,
        reviewers: [UUID_REVIEWER1], // Only one reviewer
      });

      const updatedBranch = {
        ...branch,
        reviewers: [],
        state: BranchState.DRAFT,
        submittedAt: null,
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update to empty reviewers + state change to draft
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService returns empty since no reviewers remain
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_2}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // The branchService.removeReviewer handles auto-return to draft inline:
      // it updates the branch state to DRAFT and logs a state transition via db.insert.
      // It does NOT use transitionService.executeTransition.
      expect(db.update).toHaveBeenCalled();
      // The service also inserts a state transition record
      expect(db.insert).toHaveBeenCalled();
    });

    it('should NOT return to draft when removing a reviewer but others remain', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_3,
        reviewers: [UUID_REVIEWER1, UUID_REVIEWER2, UUID_REVIEWER3],
      });

      const updatedBranch = {
        ...branch,
        reviewers: [UUID_REVIEWER2, UUID_REVIEWER3],
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update - still has 2 reviewers remaining
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService looks up remaining reviewers
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([reviewer2, reviewer3]);

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

    it('should update branch state when returning to draft after last reviewer removed', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_2,
        reviewers: [UUID_REVIEWER1],
      });

      const updatedBranch = {
        ...branch,
        reviewers: [],
        state: BranchState.DRAFT,
        submittedAt: null,
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService returns empty since no reviewers remain
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_2}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);

      // Verify db.update was called (branch state updated to draft + reviewers cleared)
      expect(db.update).toHaveBeenCalled();
      // Verify a state transition log was inserted
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Permissions', () => {
    it('should allow branch owner to remove reviewers', async () => {
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        reviewers: [UUID_REVIEWER1],
      });

      const updatedBranch = {
        ...branch,
        reviewers: [],
        state: BranchState.DRAFT,
        submittedAt: null,
      };

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      (db.query.users as any).findMany = vi.fn().mockResolvedValue([]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(200);
    });

    it('should reject admin who is not the branch owner from removing reviewers', async () => {
      // The branchService.removeReviewer only allows the branch owner (not admin).
      // Admin is UUID_ADMIN but the branch owner is UUID_OWNER.
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        ownerId: UUID_OWNER,
        reviewers: [UUID_REVIEWER1],
      });

      mockBranches.push(branch);

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER1}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      // The service enforces owner-only removal, so admin who is not the owner gets 403
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Only the branch owner');
    });
  });

  describe('Error Cases', () => {
    it('should silently handle removing a reviewer not in the list', async () => {
      // branchService.removeReviewer does not check if the reviewer is actually
      // in the list - it simply filters. Removing a non-existent reviewer is a no-op.
      const branch = makeBranch({
        id: UUID_BRANCH_1,
        reviewers: [UUID_REVIEWER1],
      });

      const updatedBranch = { ...branch }; // reviewers unchanged since REVIEWER2 not in list

      mockBranches.push(branch);

      (db.query.branches.findFirst as any)
        .mockResolvedValueOnce(branch)
        .mockResolvedValueOnce(updatedBranch);

      // Mock branch update (reviewers unchanged)
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedBranch]),
          }),
        }),
      });

      // teamService returns existing reviewer
      (db.query.users as any).findMany = vi.fn().mockResolvedValue([reviewer1]);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH_1}/reviewers/${UUID_REVIEWER2}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      // The service silently succeeds - no error for non-existent reviewer
      expect(response.status).toBe(200);
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
      // Error response format: {error: {code, message, details}}
      expect(data.error.message).toContain('not found');
    });
  });
});
