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

// Mock transition service
// Note: vi.mock is hoisted, so we cannot reference imports like BranchState here.
// Use string literals instead.
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

import { db, mockBranches, mockUsers, mockSessions, _setCurrentAuthUser } from '../../src/db';
import { transitionService } from '../../src/services/workflow/transitions';
import { validateSession } from '../../src/services/auth/session';

describe('Publish Permission Tests (T069)', () => {
  const UUID_ADMIN = '00000000-0000-4000-8000-000000000001';
  const UUID_PUBLISHER = '00000000-0000-4000-8000-000000000002';
  const UUID_REVIEWER = '00000000-0000-4000-8000-000000000003';
  const UUID_CONTRIBUTOR = '00000000-0000-4000-8000-000000000004';
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

  const publisherUser = {
    id: UUID_PUBLISHER,
    externalId: 'github-publisher',
    provider: 'github',
    email: 'publisher@example.com',
    displayName: 'Publisher User',
    roles: ['administrator'],
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

  const contributorUser = {
    id: UUID_CONTRIBUTOR,
    externalId: 'github-contributor',
    provider: 'github',
    email: 'contributor@example.com',
    displayName: 'Contributor User',
    roles: ['contributor'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (_setCurrentAuthUser as any)(null);
    mockBranches.length = 0;
    mockUsers.length = 0;
    mockSessions.length = 0;

    mockUsers.push(adminUser, publisherUser, reviewerUser, contributorUser);

    // Mock session validation
    (validateSession as any).mockImplementation((token: string) => {
      const tokenUserMap: Record<string, { sessionId: string; userId: string; role: string; user: any }> = {
        'admin-token': { sessionId: 'session-admin', userId: UUID_ADMIN, role: 'administrator', user: adminUser },
        'publisher-token': { sessionId: 'session-publisher', userId: UUID_PUBLISHER, role: 'administrator', user: publisherUser },
        'reviewer-token': { sessionId: 'session-reviewer', userId: UUID_REVIEWER, role: 'reviewer', user: reviewerUser },
        'contributor-token': { sessionId: 'session-contributor', userId: UUID_CONTRIBUTOR, role: 'contributor', user: contributorUser },
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

  describe('Role-Based Access Control', () => {
    it('should allow administrator to publish approved branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(200);
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH,
          event: 'PUBLISH',
          actorId: UUID_ADMIN,
          actorRoles: ['administrator'],
        })
      );
    });

    it('should allow publisher to publish approved branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer publisher-token',
        },
      });

      expect(response.status).toBe(200);
      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: UUID_BRANCH,
          event: 'PUBLISH',
          actorId: UUID_PUBLISHER,
          actorRoles: ['administrator'],
        })
      );
    });

    it('should deny reviewer from publishing branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer reviewer-token',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Only publishers or administrators can publish branches');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should deny contributor from publishing branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer contributor-token',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Only publishers or administrators can publish branches');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });
  });

  describe('State Validation', () => {
    it('should only allow publishing from approved state', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.APPROVED,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(200);
      expect(transitionService.executeTransition).toHaveBeenCalled();
    });

    it('should reject publishing from draft state', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('Branch must be in approved state to publish');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should reject publishing from review state', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.REVIEW,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('Branch must be in approved state to publish');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should reject publishing already published branch', async () => {
      const branch = {
        id: UUID_BRANCH,
        name: 'test-branch',
        slug: 'test-branch-123',
        ownerId: UUID_CONTRIBUTOR,
        state: BranchState.PUBLISHED,
        approvedAt: new Date(),
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBranches.push(branch);
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('Branch must be in approved state to publish');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 when branch does not exist', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(null);

      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.message).toContain('not found');
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const response = await app.request(`/api/v1/branches/${UUID_BRANCH}/publish`, {
        method: 'POST',
      });

      expect(response.status).toBe(401);
      expect(transitionService.executeTransition).not.toHaveBeenCalled();
    });
  });
});
