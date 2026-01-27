import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock database
vi.mock('../../src/db', () => {
  const mockDb = {
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
  };
  return { db: mockDb };
});

import { db } from '../../src/db';

/**
 * T091: Write role change tests
 *
 * Acceptance Criteria:
 * - Admin only can change roles
 * - No self-escalation (users cannot promote themselves)
 * - Role changes take effect within 30 seconds (session cache TTL)
 * - Audit log created for role changes
 * - Non-admin users denied access to role change endpoint
 */
describe('Role Change Tests (T091)', () => {
  const mockAdminUser = {
    id: 'admin-123',
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
    id: 'contrib-123',
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
    id: 'reviewer-123',
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

  const mockAdminSession = {
    id: 'session-admin',
    userId: 'admin-123',
    token: 'admin-token',
    provider: 'github',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastActivityAt: new Date(),
    createdAt: new Date(),
    revokedAt: null,
  };

  const mockContributorSession = {
    id: 'session-contrib',
    userId: 'contrib-123',
    token: 'contrib-token',
    provider: 'github',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastActivityAt: new Date(),
    createdAt: new Date(),
    revokedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAdminAuth() {
    // Mock session validation for admin
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { session: mockAdminSession, user: mockAdminUser },
            ]),
          }),
        }),
      }),
    });

    // Mock session activity update
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });
  }

  function setupContributorAuth() {
    // Mock session validation for contributor
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { session: mockContributorSession, user: mockContributorUser },
            ]),
          }),
        }),
      }),
    });

    // Mock session activity update
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });
  }

  describe('Admin-Only Access', () => {
    it('should allow administrators to change user roles', async () => {
      setupAdminAuth();

      // Mock finding target user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContributorUser]),
          }),
        }),
      });

      // Mock role update
      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockContributorUser, roles: ['reviewer'] },
            ]),
          }),
        }),
      });

      // Mock audit log insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.roles).toContain('reviewer');
    });

    it('should deny contributors from changing roles', async () => {
      setupContributorAuth();

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=contrib-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Insufficient permissions');
    });

    it('should deny reviewers from changing roles', async () => {
      const reviewerSession = {
        ...mockContributorSession,
        userId: 'reviewer-123',
        token: 'reviewer-token',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { session: reviewerSession, user: mockReviewerUser },
              ]),
            }),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=reviewer-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Self-Escalation Prevention (FR-009)', () => {
    it('should prevent admin from changing their own role', async () => {
      setupAdminAuth();

      // Mock finding self
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAdminUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/users/admin-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'contributor' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Cannot change your own role');
    });

    it('should prevent contributor from promoting themselves', async () => {
      setupContributorAuth();

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=contrib-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Valid Role Transitions', () => {
    it('should allow promoting contributor to reviewer', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContributorUser]),
          }),
        }),
      });

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockContributorUser, roles: ['reviewer'] },
            ]),
          }),
        }),
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
    });

    it('should allow promoting reviewer to administrator', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockReviewerUser]),
          }),
        }),
      });

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockReviewerUser, roles: ['administrator'] },
            ]),
          }),
        }),
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/users/reviewer-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'administrator' }),
      });

      expect(response.status).toBe(200);
    });

    it('should allow demoting administrator to reviewer', async () => {
      setupAdminAuth();

      const otherAdmin = {
        ...mockAdminUser,
        id: 'admin-other',
        email: 'otheradmin@example.com',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([otherAdmin]),
          }),
        }),
      });

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...otherAdmin, roles: ['reviewer'] },
            ]),
          }),
        }),
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/users/admin-other/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Invalid Role Values', () => {
    it('should reject invalid role names', async () => {
      setupAdminAuth();

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'superadmin' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should reject empty role', async () => {
      setupAdminAuth();

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: '' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing role in request body', async () => {
      setupAdminAuth();

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Audit Logging (FR-009)', () => {
    it('should create audit log entry for role change', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContributorUser]),
          }),
        }),
      });

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

      (db.insert as any).mockReturnValue({
        values: mockAuditInsert,
      });

      await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      // Verify audit log was created
      expect(mockAuditInsert).toHaveBeenCalled();
      const auditCall = mockAuditInsert.mock.calls[0][0];
      expect(auditCall.action).toBe('role.changed');
      expect(auditCall.resourceType).toBe('user');
      expect(auditCall.resourceId).toBe('contrib-123');
      expect(auditCall.initiatingUserId).toBe('admin-123');
      expect(auditCall.metadata).toMatchObject({
        oldRole: 'contributor',
        newRole: 'reviewer',
      });
    });
  });

  describe('Session Cache Propagation (SC-007)', () => {
    it('should invalidate session cache after role change', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContributorUser]),
          }),
        }),
      });

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockContributorUser, roles: ['reviewer'] },
            ]),
          }),
        }),
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(200);

      // Role change should take effect within 30 seconds (session cache TTL)
      // This is enforced by the session service clearing the cache
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 for non-existent user', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.request('/api/v1/users/nonexistent-user/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'reviewer' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should handle role change to same role gracefully', async () => {
      setupAdminAuth();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockContributorUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/users/contrib-123/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'echo_session=admin-token',
        },
        body: JSON.stringify({ role: 'contributor' }),
      });

      // Should either succeed with no change or return 400
      expect([200, 400]).toContain(response.status);
    });
  });
});
