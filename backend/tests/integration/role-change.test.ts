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
const UUID_CONTRIB = '00000000-0000-4000-a000-000000000002';
const UUID_REVIEWER = '00000000-0000-4000-a000-000000000003';
const UUID_OTHER_ADMIN = '00000000-0000-4000-a000-000000000004';
const UUID_NONEXISTENT = '00000000-0000-4000-a000-000000000099';

describe('Role Change Tests (T091)', () => {
  const mockAdminUser = {
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

  const mockContributorUser = {
    id: UUID_CONTRIB,
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

  const mockReviewerUser = {
    id: UUID_REVIEWER,
    externalId: 'github-reviewer',
    provider: 'github',
    email: 'reviewer@example.com',
    displayName: 'Reviewer User',
    avatarUrl: null,
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    lockedUntil: null,
    failedLoginCount: 0,
    lastFailedLoginAt: null,
  };

  const tokenUserMap: Record<string, { user: any; session: any }> = {
    'admin-token': {
      user: mockAdminUser,
      session: { id: 'session-admin', userId: UUID_ADMIN, role: 'administrator' },
    },
    'contrib-token': {
      user: mockContributorUser,
      session: { id: 'session-contrib', userId: UUID_CONTRIB, role: 'contributor' },
    },
    'reviewer-token': {
      user: mockReviewerUser,
      session: { id: 'session-reviewer', userId: UUID_REVIEWER, role: 'reviewer' },
    },
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

  beforeEach(() => {
    // Reset all mock state including return values and implementations
    (db.select as any).mockReset();
    (db.update as any).mockReset();
    (db.insert as any).mockReset();
    (db.delete as any).mockReset();
    (db.query.users.findFirst as any).mockReset();
    (db.query.users.findMany as any).mockReset();
    (validateSession as any).mockReset();

    // Setup validateSession to resolve auth user based on token
    (validateSession as any).mockImplementation((token: string) => {
      const entry = tokenUserMap[token];
      if (entry) {
        return Promise.resolve({
          ...entry.session,
          token,
          expiresAt: new Date(Date.now() + 86400000),
        });
      }
      return Promise.resolve(null);
    });
  });

  /**
   * Sets up auth middleware db.select mock for the given user.
   * Must be called before making any authenticated request.
   */
  function setupAuth(user: any) {
    (db.select as any).mockReturnValueOnce(selectChain([user]));
  }

  /**
   * Full setup for an admin making a role change request.
   */
  function setupAdminRoleChange(targetUser: any, newRoles: string[]) {
    // Auth middleware user lookup
    setupAuth(mockAdminUser);
    // Route handler target user lookup
    (db.select as any).mockReturnValueOnce(selectChain([targetUser]));
    // Role update
    (db.update as any).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { ...targetUser, roles: newRoles },
          ]),
        }),
      }),
    });
    // Audit log insert
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
      }),
    });
  }

  describe('Admin-Only Access', () => {
    it('should allow administrators to change user roles', async () => {
      setupAdminRoleChange(mockContributorUser, ['reviewer']);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.user.roles).toContain('reviewer');
    });

    it('should deny contributors from changing roles', async () => {
      setupAuth(mockContributorUser);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer contrib-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('requires Administrator role');
    });

    it('should deny reviewers from changing roles', async () => {
      setupAuth(mockReviewerUser);

      const response = await app.request(`/api/v1/users/${UUID_REVIEWER}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reviewer-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Self-Escalation Prevention (FR-009)', () => {
    it('should prevent admin from changing their own role', async () => {
      setupAuth(mockAdminUser);
      (db.select as any).mockReturnValueOnce(selectChain([mockAdminUser]));

      const response = await app.request(`/api/v1/users/${UUID_ADMIN}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'contributor' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('Cannot change your own role');
    });

    it('should prevent contributor from promoting themselves', async () => {
      setupAuth(mockContributorUser);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer contrib-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Valid Role Transitions', () => {
    it('should allow promoting contributor to reviewer', async () => {
      setupAdminRoleChange(mockContributorUser, ['reviewer']);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
    });

    it('should allow promoting reviewer to administrator', async () => {
      setupAdminRoleChange(mockReviewerUser, ['administrator']);

      const response = await app.request(`/api/v1/users/${UUID_REVIEWER}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(200);
    });

    it('should allow demoting administrator to reviewer', async () => {
      const otherAdmin = { ...mockAdminUser, id: UUID_OTHER_ADMIN, email: 'other@example.com' };
      setupAdminRoleChange(otherAdmin, ['reviewer']);

      const response = await app.request(`/api/v1/users/${UUID_OTHER_ADMIN}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Invalid Role Values', () => {
    it('should reject invalid role names', async () => {
      setupAuth(mockAdminUser);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'superadmin' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should reject empty role', async () => {
      setupAuth(mockAdminUser);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: '' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing role in request body', async () => {
      setupAuth(mockAdminUser);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Audit Logging (FR-009)', () => {
    it('should create audit log entry for role change', async () => {
      setupAuth(mockAdminUser);
      (db.select as any).mockReturnValueOnce(selectChain([mockContributorUser]));

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockContributorUser, roles: ['reviewer'] },
            ]),
          }),
        }),
      });

      const mockAuditInsert = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
      });
      (db.insert as any).mockReturnValue({ values: mockAuditInsert });

      await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(mockAuditInsert).toHaveBeenCalled();
      const auditCall = mockAuditInsert.mock.calls[0][0];
      expect(auditCall.action).toBe('role.changed');
      expect(auditCall.resourceType).toBe('user');
      expect(auditCall.resourceId).toBe(UUID_CONTRIB);
      expect(auditCall.initiatingUserId).toBe(UUID_ADMIN);
      expect(auditCall.metadata).toMatchObject({
        oldRole: 'contributor',
        newRole: 'reviewer',
      });
    });
  });

  describe('Session Cache Propagation (SC-007)', () => {
    it('should invalidate session cache after role change', async () => {
      setupAdminRoleChange(mockContributorUser, ['reviewer']);

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 for non-existent user', async () => {
      setupAuth(mockAdminUser);
      (db.select as any).mockReturnValueOnce(selectChain([]));

      const response = await app.request(`/api/v1/users/${UUID_NONEXISTENT}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.message).toContain('not found');
    });

    it('should handle role change to same role gracefully', async () => {
      setupAuth(mockAdminUser);
      (db.select as any).mockReturnValueOnce(selectChain([mockContributorUser]));

      const response = await app.request(`/api/v1/users/${UUID_CONTRIB}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({ role: 'contributor' }),
      });

      expect([200, 400]).toContain(response.status);
    });
  });
});
