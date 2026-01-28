import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState, Visibility } from '@echo-portal/shared';

// Mock database
vi.mock('../../src/db', () => {
  const mockBranches: any[] = [];

  const mockDb = {
    query: {
      branches: {
        findFirst: vi.fn(),
      },
    },
  };

  return {
    db: mockDb,
    mockBranches,
  };
});

// Mock diff service at top level so it is properly hoisted
vi.mock('../../src/services/git/diff', () => ({
  diffService: {
    getBranchDiff: vi.fn().mockResolvedValue({
      files: [],
      stats: { filesChanged: 0, additions: 0, deletions: 0 },
    }),
    getChangeSummary: vi.fn().mockResolvedValue({
      added: [],
      modified: [],
      deleted: [],
      total: 0,
    }),
  },
  DiffService: vi.fn(),
}));

import { db, mockBranches } from '../../src/db';

describe('Anonymous Access Tests (T075)', () => {
  const UUID_BRANCH_PUBLIC_PUBLISHED = '00000000-0000-4000-8000-000000000001';
  const UUID_BRANCH_PUBLIC_DRAFT = '00000000-0000-4000-8000-000000000002';
  const UUID_BRANCH_PRIVATE_PUBLISHED = '00000000-0000-4000-8000-000000000003';
  const UUID_BRANCH_TEAM_PUBLISHED = '00000000-0000-4000-8000-000000000004';
  const UUID_OWNER = '00000000-0000-4000-8000-000000000010';

  beforeEach(() => {
    vi.clearAllMocks();
    mockBranches.length = 0;
  });

  describe('View Published Public Branches', () => {
    it('should allow anonymous access to published public branch', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_PUBLISHED,
        name: 'public-published-branch',
        slug: 'public-published-branch-123',
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_PUBLISHED}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(UUID_BRANCH_PUBLIC_PUBLISHED);
      expect(data.data.name).toBe('public-published-branch');
      expect(data.data.state).toBe(BranchState.PUBLISHED);
      expect(data.data.visibility).toBe(Visibility.PUBLIC);
    });

    it('should allow anonymous access to branch diff for public published branch', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_PUBLISHED,
        name: 'public-published-branch',
        slug: 'public-published-branch-123',
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_PUBLISHED}/diff`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(200);
    });

    it('should allow anonymous access to diff summary for public published branch', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_PUBLISHED,
        name: 'public-published-branch',
        slug: 'public-published-branch-123',
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_PUBLISHED}/diff/summary`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Deny Access to Draft Branches', () => {
    it('should deny anonymous access to public draft branch', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_DRAFT,
        name: 'public-draft-branch',
        slug: 'public-draft-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PUBLIC,
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_DRAFT}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('ACCESS_DENIED');
      expect(data.error.message).toContain('not published');
      expect(data.error.details?.guidance).toBeDefined();
      expect(data.error.details?.guidance.currentState).toBe(BranchState.DRAFT);
      expect(data.error.details?.guidance.action).toContain('sign in');
    });

    it('should deny anonymous access to draft branch diff', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_DRAFT,
        name: 'public-draft-branch',
        slug: 'public-draft-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PUBLIC,
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_DRAFT}/diff`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('Deny Access to Private Branches', () => {
    it('should deny anonymous access to private published branch', async () => {
      const branch = {
        id: UUID_BRANCH_PRIVATE_PUBLISHED,
        name: 'private-published-branch',
        slug: 'private-published-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        visibility: Visibility.PRIVATE,
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PRIVATE_PUBLISHED}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('ACCESS_DENIED');
      expect(data.error.message).toContain('not public');
      expect(data.error.details?.guidance).toBeDefined();
      expect(data.error.details?.guidance.visibility).toBe(Visibility.PRIVATE);
      expect(data.error.details?.guidance.action).toContain('sign in');
    });

    it('should deny anonymous access to team visibility branch', async () => {
      const branch = {
        id: UUID_BRANCH_TEAM_PUBLISHED,
        name: 'team-published-branch',
        slug: 'team-published-branch-123',
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
      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_TEAM_PUBLISHED}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('ACCESS_DENIED');
      expect(data.error.message).toContain('not public');
      expect(data.error.details?.guidance.visibility).toBe(Visibility.TEAM);
    });
  });

  describe('Error Responses with Actionable Guidance', () => {
    it('should provide actionable guidance for draft branch access', async () => {
      const branch = {
        id: UUID_BRANCH_PUBLIC_DRAFT,
        name: 'draft-branch',
        slug: 'draft-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.DRAFT,
        visibility: Visibility.PUBLIC,
        createdAt: new Date(),
        updatedAt: new Date(),
        gitRef: 'refs/heads/test',
        baseRef: 'main',
        baseCommit: 'abc123',
        headCommit: 'def456',
        reviewers: [],
        labels: [],
      };

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PUBLIC_DRAFT}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();

      // Verify guidance structure
      expect(data.error.details?.guidance).toBeDefined();
      expect(data.error.details.guidance.reason).toBeDefined();
      expect(data.error.details.guidance.currentState).toBe(BranchState.DRAFT);
      expect(data.error.details.guidance.action).toBeDefined();
      expect(data.error.details.guidance.action).toContain('sign in');
    });

    it('should provide actionable guidance for private branch access', async () => {
      const branch = {
        id: UUID_BRANCH_PRIVATE_PUBLISHED,
        name: 'private-branch',
        slug: 'private-branch-123',
        ownerId: UUID_OWNER,
        state: BranchState.PUBLISHED,
        visibility: Visibility.PRIVATE,
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

      (db.query.branches.findFirst as any).mockResolvedValue(branch);

      const response = await app.request(
        `/api/v1/public/branches/${UUID_BRANCH_PRIVATE_PUBLISHED}`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();

      // Verify guidance structure
      expect(data.error.details?.guidance).toBeDefined();
      expect(data.error.details.guidance.reason).toBeDefined();
      expect(data.error.details.guidance.visibility).toBe(Visibility.PRIVATE);
      expect(data.error.details.guidance.action).toBeDefined();
      expect(data.error.details.guidance.action).toContain('sign in');
      expect(data.error.details.guidance.action).toContain('contact');
    });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent branch', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(null);

      const response = await app.request(
        `/api/v1/public/branches/00000000-0000-4000-8000-999999999999`,
        {
          method: 'GET',
        }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});
