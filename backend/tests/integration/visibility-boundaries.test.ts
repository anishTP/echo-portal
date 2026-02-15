import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState, Visibility } from '@echo-portal/shared';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
}));

// Mock database
vi.mock('../../src/db', () => {
  const mockBranches: any[] = [];
  const mockUsers: any[] = [];
  const mockSessions: any[] = [];

  // Track the current auth user resolved by validateSession so db.select() can return it
  let _currentAuthUser: any = null;

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            return Promise.resolve(_currentAuthUser ? [_currentAuthUser] : []);
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    query: {
      branches: {
        findFirst: vi.fn(),
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
    mockBranches,
    mockUsers,
    mockSessions,
    _setCurrentAuthUser: (user: any) => { _currentAuthUser = user; },
  };
});

// Mock transition service at module level (vi.mock is hoisted, so cannot reference runtime variables)
vi.mock('../../src/services/workflow/transitions', () => ({
  transitionService: {
    executeTransition: vi.fn().mockResolvedValue({
      id: 'transition-id',
      success: true,
      branch: {
        id: 'branch-1',
        state: 'published',
        publishedAt: new Date().toISOString(),
      },
    }),
  },
}));

// Mock content services used by checkBranchHasContent helper in the route
vi.mock('../../src/services/content/content-service', () => ({
  contentService: {
    listByBranch: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    markPublished: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/content/content-inheritance-service', () => ({
  contentInheritanceService: {
    computeBranchDiff: vi.fn().mockResolvedValue({ hasChanges: false, added: [], modified: [], removed: [] }),
  },
}));

// Mock review service used by GET /:id route
vi.mock('../../src/services/review/review-service', () => ({
  reviewService: {
    getByBranch: vi.fn().mockResolvedValue([]),
  },
}));

// Mock content merge service used by publish route
vi.mock('../../src/services/content/content-merge-service', () => ({
  contentMergeService: {
    mergeContentIntoMain: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock notification triggers
vi.mock('../../src/services/notification/notification-triggers', () => ({
  notifyContentPublished: vi.fn(),
  notifyCollaboratorAdded: vi.fn(),
  notifyCollaboratorRemoved: vi.fn(),
  notifyBranchArchived: vi.fn(),
}));

// Mock branch service to control getById/update/delete/addReviewers behavior
// Uses real AppError classes so the error handler returns proper status codes.
vi.mock('../../src/services/branch/branch-service', async () => {
  const { ForbiddenError, NotFoundError } = await import('../../src/api/utils/errors.js');

  const _mockBranchServiceState: { getByIdResult: any; updateResult: any } = {
    getByIdResult: null,
    updateResult: null,
  };

  const makeBranchLike = (data: any) => ({
    ...data,
    toJSON: () => data,
    toResponseForUser: () => data,
    canEdit: () => data.state === 'draft',
    canSubmitForReview: () => data.state === 'draft',
    canApprove: () => data.state === 'review',
    canPublish: () => data.state === 'approved',
    canArchive: () => data.state !== 'archived',
    getValidTransitions: () => [],
  });

  return {
    branchService: {
      getById: vi.fn().mockImplementation(() => {
        const result = _mockBranchServiceState.getByIdResult;
        return Promise.resolve(result ? makeBranchLike(result) : null);
      }),
      update: vi.fn().mockImplementation((_id: string, input: any, actorId: string) => {
        const result = _mockBranchServiceState.getByIdResult;
        if (!result) {
          throw new NotFoundError('Branch', _id);
        }
        // Admin-only fields (requiredApprovals) bypass ownership/state checks
        // because the route handler already validates admin role
        if (!('requiredApprovals' in input)) {
          if (result.state !== 'draft') {
            throw new ForbiddenError(
              `Cannot update branch in '${result.state}' state. Only draft branches can be edited.`
            );
          }
          if (result.ownerId !== actorId) {
            throw new ForbiddenError('Only the branch owner can update this branch');
          }
        }
        const updated = { ...result, ...input };
        return Promise.resolve(makeBranchLike(updated));
      }),
      delete: vi.fn().mockImplementation((_id: string, actorId: string) => {
        const result = _mockBranchServiceState.getByIdResult;
        if (!result) throw new NotFoundError('Branch', _id);
        if (result.ownerId !== actorId) {
          throw new ForbiddenError('Only the branch owner can delete this branch');
        }
        return Promise.resolve();
      }),
      addReviewers: vi.fn().mockImplementation((_id: string, _reviewerIds: string[], actorId: string) => {
        const result = _mockBranchServiceState.getByIdResult;
        if (!result) throw new NotFoundError('Branch', _id);
        if (result.ownerId !== actorId) {
          throw new ForbiddenError('Only the branch owner can add reviewers');
        }
        return Promise.resolve(makeBranchLike(result));
      }),
      create: vi.fn(),
      list: vi.fn(),
      getByOwner: vi.fn(),
      getByReviewer: vi.fn(),
      removeReviewer: vi.fn(),
      updateHeadCommit: vi.fn(),
      getMainBranch: vi.fn().mockResolvedValue(null),
    },
    _mockBranchServiceState,
  };
});

import { db, mockBranches, mockUsers, mockSessions, _setCurrentAuthUser } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';
import { _mockBranchServiceState } from '../../src/services/branch/branch-service';

describe('Visibility Boundary Tests (T076)', () => {
  const UUID_ADMIN = '00000000-0000-4000-8000-000000000001';
  const UUID_OWNER = '00000000-0000-4000-8000-000000000002';
  const UUID_COLLABORATOR = '00000000-0000-4000-8000-000000000003';
  const UUID_REVIEWER = '00000000-0000-4000-8000-000000000004';
  const UUID_OTHER_USER = '00000000-0000-4000-8000-000000000005';
  const UUID_BRANCH = '00000000-0000-4000-8000-000000000010';

  const adminUser = {
    id: UUID_ADMIN,
    externalId: 'github-admin',
    provider: 'github',
    email: 'admin@example.com',
    displayName: 'Admin User',
    roles: ['administrator'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ownerUser = {
    id: UUID_OWNER,
    externalId: 'github-owner',
    provider: 'github',
    email: 'owner@example.com',
    displayName: 'Owner User',
    roles: ['contributor'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const collaboratorUser = {
    id: UUID_COLLABORATOR,
    externalId: 'github-collaborator',
    provider: 'github',
    email: 'collaborator@example.com',
    displayName: 'Collaborator User',
    roles: ['contributor'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const reviewerUser = {
    id: UUID_REVIEWER,
    externalId: 'github-reviewer',
    provider: 'github',
    email: 'reviewer@example.com',
    displayName: 'Reviewer User',
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const otherUser = {
    id: UUID_OTHER_USER,
    externalId: 'github-other',
    provider: 'github',
    email: 'other@example.com',
    displayName: 'Other User',
    roles: ['contributor'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (_setCurrentAuthUser as any)(null);
    _mockBranchServiceState.getByIdResult = null;
    mockBranches.length = 0;
    mockUsers.length = 0;
    mockSessions.length = 0;

    mockUsers.push(adminUser, ownerUser, collaboratorUser, reviewerUser, otherUser);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      const tokenUserMap: Record<string, { sessionId: string; userId: string; role: string; user: any }> = {
        'admin-token': { sessionId: 'session-admin', userId: UUID_ADMIN, role: 'administrator', user: adminUser },
        'owner-token': { sessionId: 'session-owner', userId: UUID_OWNER, role: 'contributor', user: ownerUser },
        'collaborator-token': { sessionId: 'session-collaborator', userId: UUID_COLLABORATOR, role: 'contributor', user: collaboratorUser },
        'reviewer-token': { sessionId: 'session-reviewer', userId: UUID_REVIEWER, role: 'reviewer', user: reviewerUser },
        'other-token': { sessionId: 'session-other', userId: UUID_OTHER_USER, role: 'contributor', user: otherUser },
      };

      const mapping = tokenUserMap[token];
      if (mapping) {
        // Set the auth user so db.select() chain in auth middleware resolves correctly
        (_setCurrentAuthUser as any)(mapping.user);
        return Promise.resolve({
          id: mapping.sessionId,
          userId: mapping.userId,
          token,
          role: mapping.role,
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      (_setCurrentAuthUser as any)(null);
      return Promise.resolve(null);
    });

    (db.query.users.findFirst as any).mockImplementation(({ where }: any) => {
      const user = mockUsers.find((u) => u.id === where);
      return Promise.resolve(user);
    });
  });

  describe('Collaborator Read-Only Access', () => {
    it('should allow collaborator to view private branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [UUID_COLLABORATOR],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer collaborator-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH);
    });

    it('should deny collaborator from updating branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [UUID_COLLABORATOR],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer collaborator-token',
        },
        body: JSON.stringify({ name: 'new-name' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('owner');
    });

    it('should deny collaborator from adding reviewers', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [UUID_COLLABORATOR],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/reviewers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer collaborator-token',
        },
        body: JSON.stringify({ reviewerIds: [UUID_REVIEWER] }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('owner');
    });

    it('should deny collaborator from deleting branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [UUID_COLLABORATOR],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer collaborator-token',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('owner');
    });
  });

  describe('Reviewer Access', () => {
    it('should allow reviewer to view branch in review state', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.REVIEW,
        visibility: Visibility.PRIVATE,
        collaborators: [],
        reviewers: [UUID_REVIEWER],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer reviewer-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH);
    });

    it('should deny reviewer from updating branch metadata', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.REVIEW,
        visibility: Visibility.PRIVATE,
        collaborators: [],
        reviewers: [UUID_REVIEWER],
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-token',
        },
        body: JSON.stringify({ description: 'new description' }),
      });

      // Should fail because branch is not in draft state
      expect(response.status).toBe(403);
    });

    it('should deny non-assigned reviewer from viewing private branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.REVIEW,
        visibility: Visibility.PRIVATE,
        collaborators: [],
        reviewers: [UUID_OTHER_USER], // Different reviewer
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer reviewer-token',
        },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Admin Full Access', () => {
    it('should allow admin to view any private branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH);
    });

    it('should allow admin to configure approval threshold', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.REVIEW,
        visibility: Visibility.PRIVATE,
        reviewers: [],
        requiredApprovals: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/approval-threshold`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ requiredApprovals: 3 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.requiredApprovals).toBe(3);
    });

    it('should allow admin to publish approved branches', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.APPROVED,
        visibility: Visibility.PRIVATE,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        reviewers: [],
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Visibility Levels', () => {
    it('should allow any authenticated user to view public branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        visibility: Visibility.PUBLIC,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        reviewers: [],
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer other-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH);
    });

    it('should allow any authenticated user to view team visibility branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        visibility: Visibility.TEAM,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        reviewers: [],
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer other-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH);
    });

    it('should deny unrelated user from viewing private branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PRIVATE,
        collaborators: [],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        labels: [],
      };

      mockBranches.push(branch);
      _mockBranchServiceState.getByIdResult = branch;
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer other-token',
        },
      });

      expect(response.status).toBe(403);
    });
  });
});
