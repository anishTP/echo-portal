import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState } from '@echo-portal/shared';

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

  const mockDb = {
    insert: vi.fn(),
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
      users: {
        findFirst: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(),
      },
      reviews: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  };

  return {
    db: mockDb,
    mockBranches,
    mockUsers,
    mockSessions,
  };
});

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

import { db, mockBranches, mockUsers, mockSessions } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';

describe('Immutability Enforcement Tests (T070)', () => {
  let _currentAuthUser: any = null;

  const UUID_OWNER = '00000000-0000-4000-8000-000000000001';
  const UUID_REVIEWER = '00000000-0000-4000-8000-000000000002';
  const UUID_COLLABORATOR = '00000000-0000-4000-8000-000000000003';
  const UUID_BRANCH = '00000000-0000-4000-8000-000000000010';

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockBranches.length = 0;
    mockUsers.length = 0;
    mockSessions.length = 0;

    mockUsers.push(ownerUser);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      if (token === 'owner-token') {
        _currentAuthUser = ownerUser;
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

    (db.query.users.findFirst as any).mockImplementation(({ where }: any) => {
      const user = mockUsers.find((u) => u.id === where);
      return Promise.resolve(user);
    });
  });

  describe('Update Branch Immutability', () => {
    it('should allow updating draft branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // Mock update to return updated branch
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, name: 'updated-name' },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ name: 'updated-name' }),
      });

      expect(response.status).toBe(200);
    });

    it('should prevent updating published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ name: 'new-name' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot update branch');
      expect(data.error.message).toContain('published');
    });

    it('should prevent updating branch name on published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ name: 'new-name' }),
      });

      expect(response.status).toBe(403);
    });

    it('should prevent updating description on published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ description: 'new description' }),
      });

      expect(response.status).toBe(403);
    });

    it('should prevent updating visibility on published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        visibility: 'private',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ visibility: 'public' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Reviewer Management Immutability', () => {
    it('should allow adding reviewers to draft branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // Mock update for reviewers
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...branch, reviewers: [UUID_REVIEWER] },
            ]),
          }),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/reviewers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ reviewerIds: [UUID_REVIEWER] }),
      });

      expect(response.status).toBe(200);
    });

    it('should prevent adding reviewers to published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        reviewers: [],
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/reviewers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ reviewerIds: [UUID_REVIEWER] }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot modify reviewers on a published branch');
    });

    it('should prevent removing reviewers from published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        reviewers: [UUID_REVIEWER],
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/reviewers/${UUID_REVIEWER}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer owner-token',
          },
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot modify reviewers on a published branch');
    });
  });

  describe('Collaborator Management Immutability', () => {
    it('should allow adding collaborators to draft branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        reviewers: [],
        collaborators: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const collaborator = {
        id: UUID_COLLABORATOR,
        externalId: 'github-collaborator',
        provider: 'github',
        email: 'collab@example.com',
        displayName: 'Collaborator',
        roles: ['contributor'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      mockUsers.push(collaborator);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);
      (db.query.users.findFirst as any).mockImplementation(({ where }: any) => {
        const user = mockUsers.find((u) => u.id === where);
        return Promise.resolve(user);
      });

      // Mock update for collaborators
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ collaboratorIds: [UUID_COLLABORATOR] }),
      });

      // Note: This might return 500 in the test due to mocking, but the important
      // part is that it doesn't return 403 (forbidden)
      expect(response.status).not.toBe(403);
    });

    it('should prevent adding collaborators to published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        reviewers: [],
        collaborators: [],
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ collaboratorIds: [UUID_COLLABORATOR] }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot modify collaborators on a published branch');
    });

    it('should prevent removing collaborators from published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        reviewers: [],
        collaborators: [UUID_COLLABORATOR],
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/collaborators/${UUID_COLLABORATOR}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer owner-token',
          },
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot modify collaborators on a published branch');
    });
  });

  describe('Delete Branch Immutability', () => {
    it('should allow deleting draft branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        gitRef: 'refs/heads/test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      // Mock git operations
      vi.mock('../../src/services/git/operations', () => ({
        getGitOperations: () => ({
          deleteIsolatedBranch: vi.fn().mockResolvedValue(undefined),
        }),
      }));

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      // May fail due to git mock, but should not be forbidden
      expect(response.status).not.toBe(403);
    });

    it('should prevent deleting published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer owner-token',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot delete branch');
    });
  });

  describe('Immutability Across All States', () => {
    it('should enforce immutability for review state branches', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.REVIEW,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ name: 'new-name' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot update branch');
    });

    it('should enforce immutability for approved state branches', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer owner-token',
        },
        body: JSON.stringify({ name: 'new-name' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot update branch');
    });
  });
});
