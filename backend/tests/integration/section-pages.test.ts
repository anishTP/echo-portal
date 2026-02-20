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
const UUID_BRANCH = '00000000-0000-4000-a000-000000000020';
const UUID_MAIN_BRANCH = '00000000-0000-4000-a000-000000000030';
const UUID_PAGE = '00000000-0000-4000-a000-000000000040';

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

const mockDraftBranch = {
  id: UUID_BRANCH,
  slug: 'test-branch',
  state: 'draft',
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

const mockSectionPage = {
  id: UUID_PAGE,
  section: 'brand',
  branchId: UUID_BRANCH,
  body: '# Brands overview',
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

describe('Section Pages API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- GET /api/v1/section-pages/:section ----------

  describe('GET /api/v1/section-pages/:section', () => {
    it('should return empty body when no page exists', async () => {
      // No branchId provided: main branch lookup, then published page lookup
      // 1) main branch lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([mockMainBranch]));
      // 2) published page lookup — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request('/api/v1/section-pages/brand');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBeNull();
      expect(body.data.section).toBe('brand');
      expect(body.data.branchId).toBeNull();
      expect(body.data.body).toBe('');
    });

    it('should return branch body when branch override exists', async () => {
      // branchId provided: branch-specific page lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([mockSectionPage]));

      const res = await app.request(
        `/api/v1/section-pages/brand?branchId=${UUID_BRANCH}`
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe(UUID_PAGE);
      expect(body.data.section).toBe('brand');
      expect(body.data.branchId).toBe(UUID_BRANCH);
      expect(body.data.body).toBe('# Brands overview');
    });

    it('should fall back to published body when no branch override', async () => {
      const publishedPage = {
        ...mockSectionPage,
        branchId: UUID_MAIN_BRANCH,
        body: '# Published brands',
      };

      // branchId provided: branch-specific page lookup — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // main branch lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([mockMainBranch]));
      // published page lookup — found
      (db.select as any).mockReturnValueOnce(selectChain([publishedPage]));

      const res = await app.request(
        `/api/v1/section-pages/brand?branchId=${UUID_BRANCH}`
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.branchId).toBe(UUID_MAIN_BRANCH);
      expect(body.data.body).toBe('# Published brands');
    });

    it('should return empty shell when no main branch exists', async () => {
      // No branchId: main branch lookup — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request('/api/v1/section-pages/brand');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBeNull();
      expect(body.data.body).toBe('');
    });

    it('should reject invalid section param', async () => {
      const res = await app.request('/api/v1/section-pages/invalid');
      expect(res.status).toBe(400);
    });
  });

  // ---------- PUT /api/v1/section-pages/:section ----------

  describe('PUT /api/v1/section-pages/:section', () => {
    it('should create section page on first save', async () => {
      setupAdminAuth();
      // Branch validation — draft branch found
      (db.select as any).mockReturnValueOnce(selectChain([mockDraftBranch]));
      // Existing page check — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Insert
      const createdPage = {
        ...mockSectionPage,
        body: '# New page content',
      };
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdPage]),
        }),
      });

      const res = await app.request('/api/v1/section-pages/brand', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# New page content',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.body).toBe('# New page content');
    });

    it('should update existing section page', async () => {
      setupAdminAuth();
      // Branch validation — draft branch found
      (db.select as any).mockReturnValueOnce(selectChain([mockDraftBranch]));
      // Existing page check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockSectionPage]));
      // Update
      const updatedPage = {
        ...mockSectionPage,
        body: '# Updated content',
        updatedAt: new Date(),
      };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedPage]),
          }),
        }),
      });

      const res = await app.request('/api/v1/section-pages/brand', {
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
    });

    it('should reject non-admin users', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/section-pages/brand', {
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
      // Branch validation — published branch found (not draft)
      const publishedBranch = { ...mockDraftBranch, state: 'published' };
      (db.select as any).mockReturnValueOnce(selectChain([publishedBranch]));

      const res = await app.request('/api/v1/section-pages/brand', {
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

    it('should reject unauthenticated requests', async () => {
      setupUnauthenticated();

      const res = await app.request('/api/v1/section-pages/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: UUID_BRANCH,
          body: '# Content',
        }),
      });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent branch', async () => {
      setupAdminAuth();
      // Branch validation — not found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request('/api/v1/section-pages/brand', {
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

    it('should reject invalid section param', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/section-pages/invalid', {
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

      expect(res.status).toBe(400);
    });
  });
});
