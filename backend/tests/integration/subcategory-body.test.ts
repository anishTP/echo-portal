import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
  invalidateUserSessionCache: vi.fn(),
}));

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      branches: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    contents: 'contents',
    subcategories: 'subcategories',
    categories: 'categories',
    users: 'users',
    branches: 'branches',
  },
}));

// Mock branch service (used by assertDraftBranch)
vi.mock('../../src/services/branch/branch-service', () => ({
  branchService: {
    getById: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
  auditLogger: {
    log: vi.fn().mockResolvedValue('audit-id'),
    logContentEditEvent: vi.fn().mockResolvedValue('audit-id'),
  },
}));

// Mock content service (used by PATCH /contents/:contentId/move)
vi.mock('../../src/services/content/content-service', () => ({
  contentService: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listByBranch: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listPublished: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getPublishedBySlug: vi.fn(),
    search: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    markPublished: vi.fn(),
    syncDraft: vi.fn(),
  },
}));

// Mock version service (imported by contents route)
vi.mock('../../src/services/content/version-service', () => ({
  versionService: {
    getVersions: vi.fn(),
    getVersion: vi.fn(),
    revert: vi.fn(),
  },
}));

// Mock diff service (imported by contents route)
vi.mock('../../src/services/content/diff-service', () => ({
  diffService: {
    computeDiff: vi.fn(),
  },
}));

// Mock reference service (imported by contents route)
vi.mock('../../src/services/content/reference-service', () => ({
  referenceService: {
    getReferences: vi.fn(),
    updateReferences: vi.fn(),
  },
}));

// Mock conflict resolution service (imported by contents route)
vi.mock('../../src/services/content/conflict-resolution-service', () => ({
  conflictResolutionService: {
    resolveConflict: vi.fn(),
  },
}));

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';
import { branchService } from '../../src/services/branch/branch-service';

const UUID_CONTRIBUTOR = '00000000-0000-4000-a000-000000000002';
const UUID_CATEGORY = '00000000-0000-4000-a000-000000000010';
const UUID_SUBCATEGORY = '00000000-0000-4000-a000-000000000050';
const UUID_BRANCH = '00000000-0000-4000-a000-000000000020';

const mockContributor = {
  id: UUID_CONTRIBUTOR,
  externalId: 'github-contrib',
  provider: 'github',
  email: 'contrib@example.com',
  displayName: 'Contributor',
  avatarUrl: null,
  roles: ['contributor'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  lockedUntil: null,
  failedLoginCount: 0,
  lastFailedLoginAt: null,
};

const mockSubcategory = {
  id: UUID_SUBCATEGORY,
  name: 'SUVs',
  categoryId: UUID_CATEGORY,
  displayOrder: 0,
  body: '',
  createdBy: UUID_CONTRIBUTOR,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBranch = {
  id: UUID_BRANCH,
  name: 'test',
  slug: 'test',
  gitRef: 'test',
  baseRef: 'main',
  baseCommit: 'abc',
  headCommit: 'def',
  state: 'draft',
  visibility: 'private',
  ownerId: UUID_CONTRIBUTOR,
  reviewers: [],
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
};

function selectChain(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function selectChainOrdered(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function updateChain(result: any) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([result]),
      }),
    }),
  };
}

function setupContributorAuth() {
  (validateSession as any).mockResolvedValue({
    userId: UUID_CONTRIBUTOR,
    role: 'contributor',
    id: 'session-contrib',
    expiresAt: new Date(Date.now() + 86400000),
  });
  // Auth middleware user lookup
  (db.select as any).mockReturnValueOnce(selectChain([mockContributor]));
}

function setupUnauthenticated() {
  (validateSession as any).mockResolvedValue(null);
}

describe('Subcategory Body Field Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- GET /api/v1/subcategories ----------

  describe('GET /api/v1/subcategories — body field', () => {
    it('returns body field with empty string default', async () => {
      setupUnauthenticated();
      const subcategoryWithBody = { ...mockSubcategory, body: '' };
      (db.select as any).mockReturnValueOnce(
        selectChainOrdered([subcategoryWithBody])
      );

      const res = await app.request(
        `/api/v1/subcategories?categoryId=${UUID_CATEGORY}`
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('SUVs');
      expect(body.data[0].body).toBe('');
    });
  });

  // ---------- PATCH /api/v1/subcategories/:id — body field ----------

  describe('PATCH /api/v1/subcategories/:id — body field', () => {
    it('updates body when provided', async () => {
      setupContributorAuth();
      // assertDraftBranch
      (branchService.getById as any).mockResolvedValue(mockBranch);
      // Find existing subcategory
      (db.select as any).mockReturnValueOnce(selectChain([mockSubcategory]));
      // Update — no name provided, so no duplicate check
      const updatedSubcategory = { ...mockSubcategory, body: '## Overview\n\nSUV models description.' };
      (db.update as any).mockReturnValue(updateChain(updatedSubcategory));

      const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '## Overview\n\nSUV models description.',
        }),
      });

      expect(res.status).toBe(200);
      const respBody = await res.json();
      expect(respBody.data.body).toBe('## Overview\n\nSUV models description.');
    });

    it('leaves body unchanged when body is omitted', async () => {
      setupContributorAuth();
      // assertDraftBranch
      (branchService.getById as any).mockResolvedValue(mockBranch);
      // Find existing subcategory
      (db.select as any).mockReturnValueOnce(selectChain([mockSubcategory]));
      // Duplicate name check — none found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Update — name provided, body omitted
      const updatedSubcategory = { ...mockSubcategory, name: 'Crossovers' };
      (db.update as any).mockReturnValue(updateChain(updatedSubcategory));

      const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'Crossovers',
          branchId: UUID_BRANCH,
        }),
      });

      expect(res.status).toBe(200);
      const respBody = await res.json();
      expect(respBody.data.name).toBe('Crossovers');
      // body remains unchanged from the mock (empty string default)
      expect(respBody.data.body).toBe('');
    });

    it('can update both name and body simultaneously', async () => {
      setupContributorAuth();
      // assertDraftBranch
      (branchService.getById as any).mockResolvedValue(mockBranch);
      // Find existing subcategory
      (db.select as any).mockReturnValueOnce(selectChain([mockSubcategory]));
      // Duplicate name check — none found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Update — both name and body
      const updatedSubcategory = {
        ...mockSubcategory,
        name: 'Trucks',
        body: 'All about trucks.',
      };
      (db.update as any).mockReturnValue(updateChain(updatedSubcategory));

      const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'Trucks',
          branchId: UUID_BRANCH,
          body: 'All about trucks.',
        }),
      });

      expect(res.status).toBe(200);
      const respBody = await res.json();
      expect(respBody.data.name).toBe('Trucks');
      expect(respBody.data.body).toBe('All about trucks.');
    });

    it('can update body only without name', async () => {
      setupContributorAuth();
      // assertDraftBranch
      (branchService.getById as any).mockResolvedValue(mockBranch);
      // Find existing subcategory
      (db.select as any).mockReturnValueOnce(selectChain([mockSubcategory]));
      // No duplicate check since name is not provided
      // Update — body only
      const updatedSubcategory = { ...mockSubcategory, body: 'Updated body content.' };
      (db.update as any).mockReturnValue(updateChain(updatedSubcategory));

      const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: 'Updated body content.',
        }),
      });

      expect(res.status).toBe(200);
      const respBody = await res.json();
      expect(respBody.data.body).toBe('Updated body content.');
      // Name should remain unchanged
      expect(respBody.data.name).toBe('SUVs');
    });
  });
});
