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
}));

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';

const UUID_ADMIN = '00000000-0000-4000-a000-000000000001';
const UUID_CONTRIBUTOR = '00000000-0000-4000-a000-000000000002';
const UUID_CATEGORY = '00000000-0000-4000-a000-000000000010';
const UUID_BRANCH = '00000000-0000-4000-a000-000000000020';
const UUID_MAIN_BRANCH = '00000000-0000-4000-a000-000000000030';
const UUID_PAGE = '00000000-0000-4000-a000-000000000040';
const UUID_NONEXISTENT = '00000000-0000-4000-a000-000000000099';

const mockAdmin = {
  id: UUID_ADMIN,
  externalId: 'github-admin',
  provider: 'github',
  email: 'admin@example.com',
  displayName: 'Admin User',
  avatarUrl: null,
  roles: ['administrator'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  lockedUntil: null,
  failedLoginCount: 0,
  lastFailedLoginAt: null,
};

const mockContributor = {
  id: UUID_CONTRIBUTOR,
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

const mockCategory = {
  id: UUID_CATEGORY,
  name: 'Vehicles',
  section: 'brand',
  displayOrder: 0,
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDraftBranch = {
  id: UUID_BRANCH,
  slug: 'test-branch',
  state: 'draft',
  name: 'Test Branch',
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockReviewBranch = {
  id: UUID_BRANCH,
  slug: 'test-branch',
  state: 'review',
  name: 'Test Branch',
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMainBranch = {
  id: UUID_MAIN_BRANCH,
  slug: 'main',
  state: 'published',
  name: 'Main',
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCategoryPage = {
  id: UUID_PAGE,
  categoryId: UUID_CATEGORY,
  branchId: UUID_BRANCH,
  body: '# Vehicles overview',
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPublishedPage = {
  id: UUID_PAGE,
  categoryId: UUID_CATEGORY,
  branchId: UUID_MAIN_BRANCH,
  body: '# Published vehicles content',
  createdBy: UUID_ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
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

function setupAdminAuth() {
  (validateSession as any).mockResolvedValue({
    userId: UUID_ADMIN,
    role: 'administrator',
    id: 'session-admin',
    expiresAt: new Date(Date.now() + 86400000),
  });
  // Auth middleware user lookup
  (db.select as any).mockReturnValueOnce(selectChain([mockAdmin]));
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

describe('Category Pages API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- GET /api/v1/category-pages/:categoryId ----------

  describe('GET /api/v1/category-pages/:categoryId', () => {
    it('should return empty body when no page exists', async () => {
      // #1: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #2: main branch lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([mockMainBranch]));
      // #3: published page check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request(`/api/v1/category-pages/${UUID_CATEGORY}`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBeNull();
      expect(body.data.categoryId).toBe(UUID_CATEGORY);
      expect(body.data.branchId).toBeNull();
      expect(body.data.body).toBe('');
      expect(body.data.createdBy).toBeNull();
      expect(body.data.createdAt).toBeNull();
      expect(body.data.updatedAt).toBeNull();
    });

    it('should return branch body when branch override exists', async () => {
      // #1: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #2: branch-specific page check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategoryPage]));

      const res = await app.request(
        `/api/v1/category-pages/${UUID_CATEGORY}?branchId=${UUID_BRANCH}`
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe(UUID_PAGE);
      expect(body.data.categoryId).toBe(UUID_CATEGORY);
      expect(body.data.branchId).toBe(UUID_BRANCH);
      expect(body.data.body).toBe('# Vehicles overview');
    });

    it('should fall back to published body when no branch override', async () => {
      // #1: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #2: branch-specific page check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // #3: main branch lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([mockMainBranch]));
      // #4: published page check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockPublishedPage]));

      const res = await app.request(
        `/api/v1/category-pages/${UUID_CATEGORY}?branchId=${UUID_BRANCH}`
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe(UUID_PAGE);
      expect(body.data.branchId).toBe(UUID_MAIN_BRANCH);
      expect(body.data.body).toBe('# Published vehicles content');
    });

    it('should return 404 for non-existent category', async () => {
      // #1: category existence check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request(
        `/api/v1/category-pages/${UUID_NONEXISTENT}`
      );
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ---------- PUT /api/v1/category-pages/:categoryId ----------

  describe('PUT /api/v1/category-pages/:categoryId', () => {
    it('should create category page on first save', async () => {
      setupAdminAuth();
      // #2: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #3: branch validation — draft branch found
      (db.select as any).mockReturnValueOnce(selectChain([mockDraftBranch]));
      // #4: existing page check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            ...mockCategoryPage,
            body: '# New content',
          }]),
        }),
      });

      const res = await app.request(`/api/v1/category-pages/${UUID_CATEGORY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# New content',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.body).toBe('# New content');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should update existing category page', async () => {
      setupAdminAuth();
      // #2: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #3: branch validation — draft branch found
      (db.select as any).mockReturnValueOnce(selectChain([mockDraftBranch]));
      // #4: existing page check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategoryPage]));
      // Update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              ...mockCategoryPage,
              body: '# Updated content',
            }]),
          }),
        }),
      });

      const res = await app.request(`/api/v1/category-pages/${UUID_CATEGORY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# Updated content',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.body).toBe('# Updated content');
      expect(db.update).toHaveBeenCalled();
    });

    it('should reject non-admin users', async () => {
      setupContributorAuth();

      const res = await app.request(`/api/v1/category-pages/${UUID_CATEGORY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# Content',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject non-draft branches', async () => {
      setupAdminAuth();
      // #2: category existence check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory]));
      // #3: branch validation — review state (not draft)
      (db.select as any).mockReturnValueOnce(selectChain([mockReviewBranch]));

      const res = await app.request(`/api/v1/category-pages/${UUID_CATEGORY}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# Content',
        }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 for non-existent category', async () => {
      setupAdminAuth();
      // #2: category existence check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request(
        `/api/v1/category-pages/${UUID_NONEXISTENT}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'echo_session=valid-token',
          },
          body: JSON.stringify({
            branchId: UUID_BRANCH,
            body: '# Content',
          }),
        }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
