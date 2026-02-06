import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import { BranchState, ReviewStatus } from '@echo-portal/shared';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
}));

// Mock diff service
vi.mock('../../src/services/git/diff', () => ({
  diffService: {
    getBranchDiff: vi.fn().mockResolvedValue({
      files: [
        {
          path: 'src/example.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: [
            {
              oldStart: 1,
              oldLines: 5,
              newStart: 1,
              newLines: 8,
              lines: [
                { type: 'context', content: 'const a = 1;', oldNumber: 1, newNumber: 1 },
                { type: 'removed', content: 'const b = 2;', oldNumber: 2 },
                { type: 'added', content: 'const b = 3;', newNumber: 2 },
              ],
            },
          ],
        },
      ],
      stats: { filesChanged: 1, additions: 10, deletions: 5 },
    }),
    getChangeSummary: vi.fn().mockResolvedValue({
      added: ['src/new-file.ts'],
      modified: ['src/example.ts'],
      deleted: [],
    }),
  },
}));

// Mock git operations
vi.mock('../../src/services/git/operations', () => ({
  getGitOperations: vi.fn().mockReturnValue({
    getHeadCommit: vi.fn().mockResolvedValue('abc123'),
  }),
}));

// Mock transition service
vi.mock('../../src/services/workflow/transitions', () => ({
  transitionService: {
    executeTransition: vi.fn().mockResolvedValue({
      id: 'transition-id',
      success: true,
    }),
  },
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock database
vi.mock('../../src/db', () => {
  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
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
      branches: { findFirst: vi.fn() },
      reviews: { findFirst: vi.fn(), findMany: vi.fn() },
      reviewSnapshots: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
      sessions: { findFirst: vi.fn() },
    },
  };

  return { db: mockDb };
});

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';
import { transitionService } from '../../src/services/workflow/transitions';

// Shared UUIDs
const UUID_OWNER = '00000000-0000-4000-8000-000000000001';
const UUID_REVIEWER = '00000000-0000-4000-8000-000000000002';
const UUID_REVIEWER2 = '00000000-0000-4000-8000-000000000003';
const UUID_BRANCH = '00000000-0000-4000-8000-000000000010';
const UUID_REVIEW = '00000000-0000-4000-8000-000000000020';
const UUID_SNAPSHOT = '00000000-0000-4000-8000-000000000030';

const ownerUser = {
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

const reviewerUser = {
  id: UUID_REVIEWER,
  externalId: 'github-reviewer',
  provider: 'github',
  email: 'reviewer@example.com',
  displayName: 'Reviewer',
  roles: ['reviewer'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testBranch = {
  id: UUID_BRANCH,
  name: 'test-branch',
  ownerId: UUID_OWNER,
  state: BranchState.REVIEW,
  baseRef: 'main',
  gitRef: 'test-branch',
  baseCommit: 'abc123',
  headCommit: 'def456',
  requiredApprovals: 1,
  reviewers: [UUID_REVIEWER],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testReview = {
  id: UUID_REVIEW,
  branchId: UUID_BRANCH,
  reviewerId: UUID_REVIEWER,
  requestedById: UUID_OWNER,
  status: ReviewStatus.PENDING,
  decision: null,
  comments: [],
  reviewCycle: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let _currentAuthUser: any = null;

beforeEach(() => {
  vi.clearAllMocks();
  _currentAuthUser = null;

  // Setup auth mock
  (validateSession as any).mockImplementation((token: string) => {
    if (token === 'owner-token') {
      _currentAuthUser = ownerUser;
      return Promise.resolve({
        id: 'session-owner',
        userId: UUID_OWNER,
        token: 'owner-token',
        expiresAt: new Date(Date.now() + 86400000),
      });
    }
    if (token === 'reviewer-token') {
      _currentAuthUser = reviewerUser;
      return Promise.resolve({
        id: 'session-reviewer',
        userId: UUID_REVIEWER,
        token: 'reviewer-token',
        expiresAt: new Date(Date.now() + 86400000),
      });
    }
    return Promise.resolve(null);
  });

  // Setup user lookup for auth middleware
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(() => {
          return Promise.resolve(_currentAuthUser ? [_currentAuthUser] : []);
        }),
      }),
    }),
  });
});

describe('In-Context Review Integration Tests', () => {
  // T079: Comparison endpoint tests
  describe('Comparison Endpoints', () => {
    it('should return branch comparison with diff data', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/comparison`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveProperty('files');
      expect(data.data).toHaveProperty('stats');
      expect(data.data.branchId).toBe(UUID_BRANCH);
      expect(data.data.baseState).toMatch(/^(current|diverged)$/);
    });

    it('should return file diff for a specific file', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/comparison/files/src%2Fexample.ts`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.path).toBe('src/example.ts');
    });

    it('should return 404 for non-existent file', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/comparison/files/nonexistent.ts`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(404);
    });
  });

  // T080: Snapshot endpoint tests
  describe('Snapshot Endpoints', () => {
    it('should return snapshot data for a review', async () => {
      const snapshot = {
        id: UUID_SNAPSHOT,
        reviewId: UUID_REVIEW,
        branchId: UUID_BRANCH,
        baseCommit: 'abc123',
        headCommit: 'def456',
        snapshotData: {
          files: [{ path: 'src/example.ts', status: 'modified', additions: 10, deletions: 5 }],
          stats: { filesChanged: 1, additions: 10, deletions: 5 },
          baseRef: 'main',
          headRef: 'test-branch',
        },
        createdAt: new Date(),
      };

      (db.query.reviewSnapshots.findFirst as any).mockResolvedValue(snapshot);

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/snapshot`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.baseCommit).toBe('abc123');
      expect(data.data.headCommit).toBe('def456');
      expect(data.data.snapshotData.files).toHaveLength(1);
    });

    it('should return 404 when snapshot does not exist', async () => {
      (db.query.reviewSnapshots.findFirst as any).mockResolvedValue(null);

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/snapshot`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(404);
    });

    it('should embed snapshot when includeSnapshot=true on GET review', async () => {
      const review = {
        ...testReview,
        toResponse: () => ({ ...testReview, id: UUID_REVIEW }),
      };

      (db.query.reviews.findFirst as any).mockResolvedValue(review);
      (db.query.reviewSnapshots.findFirst as any).mockResolvedValue({
        id: UUID_SNAPSHOT,
        reviewId: UUID_REVIEW,
        branchId: UUID_BRANCH,
        baseCommit: 'abc123',
        headCommit: 'def456',
        snapshotData: { files: [], stats: { filesChanged: 0, additions: 0, deletions: 0 }, baseRef: 'main', headRef: 'test' },
        createdAt: new Date(),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}?includeSnapshot=true`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.snapshot).toBeDefined();
      expect(data.data.snapshot.baseCommit).toBe('abc123');
    });
  });

  // T081: Comment threading tests
  describe('Comment Threading', () => {
    it('should add an inline comment anchored to a diff line', async () => {
      const reviewWithNoComments = { ...testReview, comments: [] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithNoComments);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({
            content: 'Consider refactoring this',
            path: 'src/example.ts',
            line: 42,
          }),
        }
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.path).toBe('src/example.ts');
      expect(data.data.line).toBe(42);
      expect(data.data.content).toBe('Consider refactoring this');
    });

    it('should support threaded replies', async () => {
      const parentComment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'Please fix this',
        path: 'src/example.ts',
        line: 10,
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComment = { ...testReview, comments: [parentComment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComment);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/comments/comment-1/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({ content: 'Good point, will fix' }),
        }
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.parentId).toBe('comment-1');
      expect(data.data.content).toBe('Good point, will fix');
    });

    it('should prevent replies to replies (max depth 2)', async () => {
      const parentComment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'Fix this',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const replyComment = {
        id: 'reply-1',
        authorId: UUID_OWNER,
        content: 'Done',
        parentId: 'comment-1',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComments = { ...testReview, comments: [parentComment, replyComment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComments);

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/comments/reply-1/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({ content: 'Trying to reply to reply' }),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('max');
    });

    it('should update a comment', async () => {
      const comment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'Original content',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComment = { ...testReview, comments: [comment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComment);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/comments/comment-1`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({ content: 'Updated content' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.content).toBe('Updated content');
    });

    it('should delete a comment', async () => {
      const comment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'To be deleted',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComment = { ...testReview, comments: [comment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComment);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/comments/comment-1`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(204);
    });
  });

  // T082: Review decision tests
  describe('Review Decisions', () => {
    it('should approve a review and record the decision', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.query.reviews.findFirst as any).mockResolvedValue(testReview);
      (db.query.reviews.findMany as any).mockResolvedValue([
        { ...testReview, status: ReviewStatus.COMPLETED, decision: 'approved' },
      ]);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...testReview, status: ReviewStatus.COMPLETED, decision: 'approved' },
            ]),
          }),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({ reason: 'LGTM' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.decision).toBe('approved');
    });

    it('should request changes and transition branch back to draft', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.query.reviews.findFirst as any).mockResolvedValue(testReview);

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...testReview, status: ReviewStatus.COMPLETED, decision: 'changes_requested' },
            ]),
          }),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/request-changes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({ reason: 'Please add tests' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.decision).toBe('changes_requested');

      expect(transitionService.executeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'REQUEST_CHANGES',
          reason: 'Please add tests',
        })
      );
    });

    it('should reject request-changes without reason', async () => {
      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/request-changes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer reviewer-token',
          },
          body: JSON.stringify({}),
        }
      );

      expect(response.status).toBe(400);
    });
  });

  // T083: Self-approval prevention tests
  describe('Self-Approval Prevention (FR-013a)', () => {
    it('should prevent branch owner from approving their own branch', async () => {
      const ownerReview = {
        ...testReview,
        reviewerId: UUID_OWNER,
        requestedById: UUID_OWNER,
      };

      (db.query.branches.findFirst as any).mockResolvedValue({
        ...testBranch,
        ownerId: UUID_OWNER,
      });
      (db.query.reviews.findFirst as any).mockResolvedValue(ownerReview);

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({}),
        }
      );

      // Should be rejected - self-approval
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  // Comment refresh tests (T077/T078)
  describe('Comment Refresh on Resubmission', () => {
    it('should refresh outdated comment status', async () => {
      const anchoredComment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'Fix this',
        path: 'src/example.ts',
        line: 10,
        hunkId: 'hunk-0-abc',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComments = { ...testReview, comments: [anchoredComment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComments);
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/refresh-comments`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveProperty('updatedCount');
      expect(data.data).toHaveProperty('comments');
    });

    it('should mark comments as outdated when hunk no longer exists', async () => {
      const anchoredComment = {
        id: 'comment-1',
        authorId: UUID_REVIEWER,
        content: 'Fix this',
        path: 'src/example.ts',
        line: 10,
        hunkId: 'nonexistent-hunk-id',
        isOutdated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const reviewWithComments = { ...testReview, comments: [anchoredComment] };
      (db.query.reviews.findFirst as any).mockResolvedValue(reviewWithComments);
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/refresh-comments`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Comment should be marked outdated since hunk doesn't exist
      expect(data.data.updatedCount).toBe(1);
      const outdatedComment = data.data.comments.find(
        (c: any) => c.id === 'comment-1'
      );
      expect(outdatedComment.isOutdated).toBe(true);
      expect(outdatedComment.outdatedReason).toContain('code section changed');
    });
  });

  // Review cycle tests
  describe('Review Cycles', () => {
    it('should return review cycle history for a branch', async () => {
      const reviews = [
        { ...testReview, reviewCycle: 1, status: ReviewStatus.COMPLETED, decision: 'changes_requested' },
        { ...testReview, id: 'review-2', reviewCycle: 2, status: ReviewStatus.PENDING, decision: null },
      ];

      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.query.reviews.findMany as any).mockResolvedValue(reviews);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/review-cycles`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.branchId).toBe(UUID_BRANCH);
      expect(data.data.cycles).toBeDefined();
      expect(data.data.currentCycle).toBeGreaterThanOrEqual(1);
    });
  });

  // Reviewer management tests
  describe('Reviewer Management', () => {
    it('should add a reviewer to a review', async () => {
      (db.query.reviews.findFirst as any).mockResolvedValue(testReview);
      (db.query.users.findFirst as any).mockResolvedValue(reviewerUser);
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-review-id' }]),
        }),
      });

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/reviewers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer owner-token',
          },
          body: JSON.stringify({ reviewerId: UUID_REVIEWER2 }),
        }
      );

      expect(response.status).toBe(201);
    });

    it('should remove a reviewer from a review', async () => {
      (db.query.reviews.findFirst as any).mockResolvedValue(testReview);

      const response = await app.request(
        `/api/v1/reviews/${UUID_REVIEW}/reviewers/${UUID_REVIEWER}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer owner-token' },
        }
      );

      // Should succeed (204 or 200)
      expect(response.status).toBeLessThan(300);
    });
  });

  // Review status tests
  describe('Review Status', () => {
    it('should return review status for a branch', async () => {
      (db.query.branches.findFirst as any).mockResolvedValue(testBranch);
      (db.query.reviews.findMany as any).mockResolvedValue([testReview]);

      const response = await app.request(
        `/api/v1/branches/${UUID_BRANCH}/review-status`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer reviewer-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.branchId).toBe(UUID_BRANCH);
      expect(data.data).toHaveProperty('approvalProgress');
      expect(data.data.approvalProgress).toHaveProperty('approved');
      expect(data.data.approvalProgress).toHaveProperty('required');
      expect(data.data.approvalProgress).toHaveProperty('remaining');
    });
  });
});
