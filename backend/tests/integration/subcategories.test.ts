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
import { contentService } from '../../src/services/content/content-service';

const UUID_USER_1 = '00000000-0000-4000-a000-000000000001';
const UUID_USER_VIEWER = '00000000-0000-4000-a000-000000000002';
const UUID_CATEGORY_1 = '00000000-0000-4000-a000-000000000010';
const UUID_CATEGORY_2 = '00000000-0000-4000-a000-000000000011';
const UUID_SUBCATEGORY_1 = '00000000-0000-4000-a000-000000000020';
const UUID_SUBCATEGORY_2 = '00000000-0000-4000-a000-000000000021';
const UUID_BRANCH = '00000000-0000-4000-a000-000000000030';
const UUID_CONTENT_1 = '00000000-0000-4000-a000-000000000040';
const UUID_NONEXISTENT = '00000000-0000-4000-a000-000000000099';
const UUID_INVALID = 'not-a-uuid';

const mockContributor = {
  id: UUID_USER_1,
  externalId: 'github-contrib',
  provider: 'github',
  email: 'contrib@example.com',
  displayName: 'Contributor User',
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

const mockViewer = {
  id: UUID_USER_VIEWER,
  externalId: 'github-viewer',
  provider: 'github',
  email: 'viewer@example.com',
  displayName: 'Viewer User',
  avatarUrl: null,
  roles: ['viewer'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  lockedUntil: null,
  failedLoginCount: 0,
  lastFailedLoginAt: null,
};

const mockSubcategory1 = {
  id: UUID_SUBCATEGORY_1,
  name: 'V1 Models',
  categoryId: UUID_CATEGORY_1,
  displayOrder: 0,
  createdBy: UUID_USER_1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockSubcategory2 = {
  id: UUID_SUBCATEGORY_2,
  name: 'V2 Models',
  categoryId: UUID_CATEGORY_1,
  displayOrder: 1,
  createdBy: UUID_USER_1,
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

function selectChainOrdered(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function selectChainLimit(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function setupContributorAuth() {
  (validateSession as any).mockResolvedValue({
    userId: UUID_USER_1,
    role: 'contributor',
    id: 'session-contrib',
    expiresAt: new Date(Date.now() + 86400000),
  });
  // Auth middleware user lookup
  (db.select as any).mockReturnValueOnce(selectChainLimit([mockContributor]));
}

function setupViewerAuth() {
  (validateSession as any).mockResolvedValue({
    userId: UUID_USER_VIEWER,
    role: 'viewer',
    id: 'session-viewer',
    expiresAt: new Date(Date.now() + 86400000),
  });
  // Auth middleware user lookup
  (db.select as any).mockReturnValueOnce(selectChainLimit([mockViewer]));
}

function setupUnauthenticated() {
  (validateSession as any).mockResolvedValue(null);
}

describe('Subcategory API — GET /api/v1/subcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns subcategories for a valid categoryId', async () => {
    (db.select as any).mockReturnValueOnce(
      selectChainOrdered([mockSubcategory1, mockSubcategory2])
    );

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('V1 Models');
    expect(body.data[1].name).toBe('V2 Models');
    expect(body.data[0].categoryId).toBe(UUID_CATEGORY_1);
  });

  it('returns empty array when category has no subcategories', async () => {
    (db.select as any).mockReturnValueOnce(selectChainOrdered([]));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_2}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it('returns 400 for missing categoryId', async () => {
    const res = await app.request('/api/v1/subcategories');

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID format', async () => {
    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_INVALID}`
    );

    expect(res.status).toBe(400);
  });

  it('does not require authentication (public endpoint)', async () => {
    (db.select as any).mockReturnValueOnce(selectChainOrdered([]));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    // Should succeed without auth cookies
    expect(res.status).toBe(200);
  });

  it('returns subcategories ordered by displayOrder', async () => {
    const reversed = [
      { ...mockSubcategory2, displayOrder: 0 },
      { ...mockSubcategory1, displayOrder: 1 },
    ];
    (db.select as any).mockReturnValueOnce(selectChainOrdered(reversed));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // The DB mock returns pre-ordered results, verifying the route passes them through
    expect(body.data[0].displayOrder).toBe(0);
    expect(body.data[1].displayOrder).toBe(1);
  });
});

// ---------- POST /api/v1/subcategories ----------

describe('Subcategory API — POST /api/v1/subcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 on successful creation', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Category exists check
    (db.select as any).mockReturnValueOnce(selectChainLimit([{ id: UUID_CATEGORY_1, name: 'Case Study' }]));
    // Duplicate name check — none found
    (db.select as any).mockReturnValueOnce(selectChainLimit([]));
    // Shift existing subcategories displayOrder
    (db.update as any).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    // Shift loose content displayOrder
    (db.update as any).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    // Insert new subcategory
    const createdSubcategory = {
      id: UUID_SUBCATEGORY_1,
      name: 'New Subcategory',
      categoryId: UUID_CATEGORY_1,
      displayOrder: 0,
      createdBy: UUID_USER_1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createdSubcategory]),
      }),
    });

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'New Subcategory',
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('New Subcategory');
    expect(body.data.categoryId).toBe(UUID_CATEGORY_1);
    expect(body.data.displayOrder).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is viewer role', async () => {
    setupViewerAuth();

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'Test',
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when branch is not draft', async () => {
    setupContributorAuth();
    // assertDraftBranch — branch is published, not draft
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'published' });

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'Test',
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 409 on duplicate name within category', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Category exists check
    (db.select as any).mockReturnValueOnce(selectChainLimit([{ id: UUID_CATEGORY_1, name: 'Case Study' }]));
    // Duplicate name check — found
    (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'V1 Models',
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('DUPLICATE');
  });

  it('returns 404 when category does not exist', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Category exists check — not found
    (db.select as any).mockReturnValueOnce(selectChainLimit([]));

    const res = await app.request('/api/v1/subcategories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'Test',
        categoryId: UUID_NONEXISTENT,
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ---------- PATCH /api/v1/subcategories/:id ----------

describe('Subcategory API — PATCH /api/v1/subcategories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on successful rename', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Find existing subcategory
    (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));
    // Duplicate name check — none found
    (db.select as any).mockReturnValueOnce(selectChainLimit([]));
    // Update subcategory
    const updatedSubcategory = { ...mockSubcategory1, name: 'Renamed Models' };
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedSubcategory]),
        }),
      }),
    });

    const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY_1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'Renamed Models',
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe('Renamed Models');
  });

  it('returns 404 when subcategory not found', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Find existing — not found
    (db.select as any).mockReturnValueOnce(selectChainLimit([]));

    const res = await app.request(`/api/v1/subcategories/${UUID_NONEXISTENT}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'Test',
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 on duplicate name conflict', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Find existing subcategory
    (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));
    // Duplicate name check — found another subcategory with that name
    (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory2]));

    const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY_1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        name: 'V2 Models',
        branchId: UUID_BRANCH,
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('DUPLICATE');
  });
});

// ---------- DELETE /api/v1/subcategories/:id ----------

describe('Subcategory API — DELETE /api/v1/subcategories/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on successful delete with content count', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Find existing subcategory
    (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));
    // Transaction: delete content then delete subcategory
    const mockTx = {
      delete: vi.fn()
        .mockReturnValueOnce({
          // First call: delete contents
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: UUID_CONTENT_1 },
              { id: '00000000-0000-4000-a000-000000000041' },
            ]),
          }),
        })
        .mockReturnValueOnce({
          // Second call: delete subcategory
          where: vi.fn().mockResolvedValue(undefined),
        }),
    };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const res = await app.request(
      `/api/v1/subcategories/${UUID_SUBCATEGORY_1}?branchId=${UUID_BRANCH}`,
      {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deletedSubcategory).toBe(UUID_SUBCATEGORY_1);
    expect(body.data.deletedContentCount).toBe(2);
  });

  it('returns 404 when subcategory not found', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Find existing — not found
    (db.select as any).mockReturnValueOnce(selectChainLimit([]));

    const res = await app.request(
      `/api/v1/subcategories/${UUID_NONEXISTENT}?branchId=${UUID_BRANCH}`,
      {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      }
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ---------- PUT /api/v1/subcategories/reorder ----------

describe('Subcategory API — PUT /api/v1/subcategories/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on successful reorder', async () => {
    setupContributorAuth();
    // assertDraftBranch
    (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
    // Transaction: update displayOrder for each item
    const mockTx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const res = await app.request('/api/v1/subcategories/reorder', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
        order: [
          { type: 'subcategory', id: UUID_SUBCATEGORY_2 },
          { type: 'subcategory', id: UUID_SUBCATEGORY_1 },
          { type: 'content', id: UUID_CONTENT_1 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated).toBe(3);
  });

  it('returns 400 on empty order array', async () => {
    setupContributorAuth();

    const res = await app.request('/api/v1/subcategories/reorder', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        categoryId: UUID_CATEGORY_1,
        branchId: UUID_BRANCH,
        order: [],
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------- PATCH /api/v1/contents/:contentId/move ----------

describe('Subcategory API — PATCH /api/v1/contents/:contentId/move', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on successful move', async () => {
    setupContributorAuth();
    // assertCanEditBranchContent — draft branch where user is owner
    (branchService.getById as any).mockResolvedValue({
      id: UUID_BRANCH,
      state: 'draft',
      ownerId: UUID_USER_1,
      collaborators: [],
    });
    // contentService.getById — content exists
    const mockContent = {
      id: UUID_CONTENT_1,
      title: 'Test Content',
      branchId: UUID_BRANCH,
      categoryId: UUID_CATEGORY_1,
      subcategoryId: null,
      displayOrder: 0,
    };
    (contentService.getById as any)
      .mockResolvedValueOnce(mockContent)
      .mockResolvedValueOnce({
        ...mockContent,
        subcategoryId: UUID_SUBCATEGORY_1,
        displayOrder: 2,
      });
    // db.update for the move
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const res = await app.request(`/api/v1/contents/${UUID_CONTENT_1}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-token',
      },
      body: JSON.stringify({
        branchId: UUID_BRANCH,
        subcategoryId: UUID_SUBCATEGORY_1,
        displayOrder: 2,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.subcategoryId).toBe(UUID_SUBCATEGORY_1);
    expect(body.data.displayOrder).toBe(2);
  });
});

// ---------- Edge Case Tests (T031) ----------

describe('Subcategory API — Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty subcategory delete (no content)', () => {
    it('returns 200 with deletedContentCount=0 when subcategory has no content', async () => {
      setupContributorAuth();
      (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
      (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));

      const mockTx = {
        delete: vi.fn()
          .mockReturnValueOnce({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // no content deleted
            }),
          })
          .mockReturnValueOnce({
            where: vi.fn().mockResolvedValue(undefined),
          }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      const res = await app.request(
        `/api/v1/subcategories/${UUID_SUBCATEGORY_1}?branchId=${UUID_BRANCH}`,
        {
          method: 'DELETE',
          headers: { Cookie: 'echo_session=valid-token' },
        }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.deletedSubcategory).toBe(UUID_SUBCATEGORY_1);
      expect(body.data.deletedContentCount).toBe(0);
    });
  });

  describe('POST with empty name', () => {
    it('returns 400 for empty string name (Zod min(1) rejects)', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/subcategories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: '',
          categoryId: UUID_CATEGORY_1,
          branchId: UUID_BRANCH,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH rename to same name', () => {
    it('returns 200 when renaming to the same name (no conflict with self)', async () => {
      setupContributorAuth();
      (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });
      // Find existing subcategory
      (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));
      // Duplicate check — finds the same subcategory (self), which is allowed
      (db.select as any).mockReturnValueOnce(selectChainLimit([mockSubcategory1]));
      // Update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockSubcategory1]),
          }),
        }),
      });

      const res = await app.request(`/api/v1/subcategories/${UUID_SUBCATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'V1 Models',
          branchId: UUID_BRANCH,
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('PUT reorder with mixed types', () => {
    it('handles interleaved subcategory and content items', async () => {
      setupContributorAuth();
      (branchService.getById as any).mockResolvedValue({ id: UUID_BRANCH, state: 'draft' });

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      const res = await app.request('/api/v1/subcategories/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          categoryId: UUID_CATEGORY_1,
          branchId: UUID_BRANCH,
          order: [
            { type: 'content', id: UUID_CONTENT_1 },
            { type: 'subcategory', id: UUID_SUBCATEGORY_1 },
            { type: 'content', id: '00000000-0000-4000-a000-000000000041' },
            { type: 'subcategory', id: UUID_SUBCATEGORY_2 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.updated).toBe(4);
    });
  });

  describe('DELETE with invalid branchId format', () => {
    it('returns 400 for invalid UUID branchId in query', async () => {
      setupContributorAuth();

      const res = await app.request(
        `/api/v1/subcategories/${UUID_SUBCATEGORY_1}?branchId=not-a-uuid`,
        {
          method: 'DELETE',
          headers: { Cookie: 'echo_session=valid-token' },
        }
      );

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH with invalid UUID param', () => {
    it('returns 400 for invalid UUID in path parameter', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/subcategories/not-a-uuid', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'Test',
          branchId: UUID_BRANCH,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST with name exceeding max length', () => {
    it('returns 400 for name exceeding 200 characters', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/subcategories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'A'.repeat(201),
          categoryId: UUID_CATEGORY_1,
          branchId: UUID_BRANCH,
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
