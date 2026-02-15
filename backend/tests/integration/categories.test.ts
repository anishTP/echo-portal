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
const UUID_CATEGORY_1 = '00000000-0000-4000-a000-000000000010';
const UUID_CATEGORY_2 = '00000000-0000-4000-a000-000000000011';
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

const mockCategory1 = {
  id: UUID_CATEGORY_1,
  name: 'Case Study',
  section: 'brand',
  displayOrder: 0,
  createdBy: UUID_ADMIN,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCategory2 = {
  id: UUID_CATEGORY_2,
  name: 'Tutorial',
  section: 'brand',
  displayOrder: 1,
  createdBy: UUID_ADMIN,
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
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

describe('Category API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- GET /api/v1/categories ----------

  describe('GET /api/v1/categories', () => {
    it('should list all categories without authentication', async () => {
      setupUnauthenticated();
      (db.select as any).mockReturnValueOnce(selectChainOrdered([mockCategory1, mockCategory2]));

      const res = await app.request('/api/v1/categories');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('Case Study');
      expect(body.data[1].name).toBe('Tutorial');
    });

    it('should filter categories by section', async () => {
      setupUnauthenticated();
      (db.select as any).mockReturnValueOnce(selectChainOrdered([mockCategory1]));

      const res = await app.request('/api/v1/categories?section=brand');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it('should return empty array when no categories exist', async () => {
      setupUnauthenticated();
      (db.select as any).mockReturnValueOnce(selectChainOrdered([]));

      const res = await app.request('/api/v1/categories');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });

    it('should reject invalid section value', async () => {
      setupUnauthenticated();

      const res = await app.request('/api/v1/categories?section=invalid');
      expect(res.status).toBe(400);
    });
  });

  // ---------- POST /api/v1/categories ----------

  describe('POST /api/v1/categories', () => {
    it('should create a category as admin', async () => {
      setupAdminAuth();
      // Duplicate check — none found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            ...mockCategory1,
            name: 'New Category',
          }]),
        }),
      });

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'New Category',
          section: 'brand',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('New Category');
    });

    it('should default displayOrder to 0', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([]));

      let capturedValues: any;
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((vals: any) => {
          capturedValues = vals;
          return {
            returning: vi.fn().mockResolvedValue([{ ...mockCategory1, ...vals }]),
          };
        }),
      });

      await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'Test',
          section: 'brand',
        }),
      });

      expect(capturedValues.displayOrder).toBe(0);
    });

    it('should reject duplicate category name within same section', async () => {
      setupAdminAuth();
      // Duplicate check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          name: 'Case Study',
          section: 'brand',
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('DUPLICATE');
    });

    it('should require authentication', async () => {
      setupUnauthenticated();

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', section: 'brand' }),
      });

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Test', section: 'brand' }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject empty name', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: '', section: 'brand' }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing section', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---------- PATCH /api/v1/categories/:id ----------

  describe('PATCH /api/v1/categories/:id', () => {
    it('should rename a category as admin', async () => {
      setupAdminAuth();
      // Find existing category
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));
      // Duplicate check — none found
      (db.select as any).mockReturnValueOnce(selectChain([]));
      // Transaction
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockCategory1, name: 'Renamed' }]),
            }),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Renamed' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('Renamed');
    });

    it('should update content items when category is renamed', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockCategory1, name: 'New Name' }]),
            }),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'New Name' }),
      });

      // Transaction should have 2 update calls: category + content items
      expect(mockTx.update).toHaveBeenCalledTimes(2);
    });

    it('should not update content items when name is unchanged', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockCategory1]),
            }),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Case Study' }),
      });

      // Only 1 update call: just the category itself
      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('should return 404 for non-existent category', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request(`/api/v1/categories/${UUID_NONEXISTENT}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject duplicate name within same section', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));
      // Duplicate found with different ID
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory2]));

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Tutorial' }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('DUPLICATE');
    });

    it('should require admin role', async () => {
      setupContributorAuth();

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject invalid UUID', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories/not-a-uuid', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---------- POST /api/v1/categories/rename ----------

  describe('POST /api/v1/categories/rename', () => {
    it('should rename a category by name (persistent category exists)', async () => {
      setupAdminAuth();
      // Duplicate check — no category with new name
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCategory1]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Case Study',
          newName: 'EICMA',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.oldName).toBe('Case Study');
      expect(body.data.newName).toBe('EICMA');
      // Should update both the persistent category and content items
      expect(mockTx.update).toHaveBeenCalledTimes(2);
    });

    it('should rename content-only categories (no persistent category)', async () => {
      setupAdminAuth();
      // Duplicate check — none found
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No persistent category
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Derived Category',
          newName: 'Renamed Category',
        }),
      });

      expect(res.status).toBe(200);
      // Should only update content items (no persistent category to rename)
      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('should reject when old and new names are identical', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Same',
          newName: 'Same',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('NO_CHANGE');
    });

    it('should reject when new name already exists as persistent category', async () => {
      setupAdminAuth();
      // Duplicate check — found
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory2]));

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Case Study',
          newName: 'Tutorial',
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('DUPLICATE');
    });

    it('should require admin role', async () => {
      setupContributorAuth();

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Old',
          newName: 'New',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      setupUnauthenticated();

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'brand',
          oldName: 'Old',
          newName: 'New',
        }),
      });

      expect(res.status).toBe(401);
    });

    it('should reject invalid section', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=valid-token',
        },
        body: JSON.stringify({
          section: 'invalid',
          oldName: 'Old',
          newName: 'New',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---------- DELETE /api/v1/categories/:id ----------

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete a category as admin', async () => {
      setupAdminAuth();
      // Find existing
      (db.select as any).mockReturnValueOnce(selectChain([mockCategory1]));
      // Delete
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent category', async () => {
      setupAdminAuth();
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const res = await app.request(`/api/v1/categories/${UUID_NONEXISTENT}`, {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should require admin role', async () => {
      setupContributorAuth();

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(403);
    });

    it('should require authentication', async () => {
      setupUnauthenticated();

      const res = await app.request(`/api/v1/categories/${UUID_CATEGORY_1}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
    });

    it('should reject invalid UUID', async () => {
      setupAdminAuth();

      const res = await app.request('/api/v1/categories/not-a-uuid', {
        method: 'DELETE',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(400);
    });
  });
});
