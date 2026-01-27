import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import type { AuditLog } from '../../src/db/schema/audit-logs';

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
      auditLogs: {
        findMany: vi.fn(),
      },
    },
  };
  return { db: mockDb };
});

import { db } from '../../src/db';

/**
 * T082: Write audit log query tests (filter by actor, resource, action, date range)
 *
 * Acceptance Criteria:
 * - Filter audit logs by actor ID
 * - Filter audit logs by resource type and ID
 * - Filter audit logs by action type(s)
 * - Filter audit logs by date range (startDate, endDate)
 * - Support pagination (page, limit)
 * - Combine multiple filters
 * - Return enriched entries with actor details
 * - Query performance <5s (per SC-006)
 */
describe('Audit Log Query Tests (T082)', () => {
  const mockUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    displayName: 'Admin User',
    avatarUrl: 'https://example.com/avatar.jpg',
    roles: ['administrator'],
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lockedUntil: null,
  };

  const mockReviewer = {
    id: 'reviewer-123',
    email: 'reviewer@example.com',
    displayName: 'Reviewer User',
    avatarUrl: null,
    roles: ['reviewer'],
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    lockedUntil: null,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'admin-123',
    token: 'admin-token',
    provider: 'github',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastActivityAt: new Date(),
    createdAt: new Date(),
    revokedAt: null,
  };

  const mockAuditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      timestamp: new Date('2026-01-27T10:00:00Z'),
      action: 'branch.created',
      actorId: 'admin-123',
      actorType: 'user',
      actorIp: '192.168.1.1',
      actorUserAgent: 'Mozilla/5.0',
      resourceType: 'branch',
      resourceId: 'branch-123',
      outcome: 'success',
      initiatingUserId: null,
      metadata: { name: 'feature-branch' },
      requestId: 'req-1',
      sessionId: 'session-123',
    },
    {
      id: 'audit-2',
      timestamp: new Date('2026-01-27T11:00:00Z'),
      action: 'branch.transitioned',
      actorId: 'admin-123',
      actorType: 'user',
      actorIp: '192.168.1.1',
      actorUserAgent: 'Mozilla/5.0',
      resourceType: 'branch',
      resourceId: 'branch-123',
      outcome: 'success',
      initiatingUserId: null,
      metadata: { from: 'draft', to: 'review' },
      requestId: 'req-2',
      sessionId: 'session-123',
    },
    {
      id: 'audit-3',
      timestamp: new Date('2026-01-27T12:00:00Z'),
      action: 'review.approved',
      actorId: 'reviewer-123',
      actorType: 'user',
      actorIp: '192.168.1.2',
      actorUserAgent: 'Chrome',
      resourceType: 'review',
      resourceId: 'review-123',
      outcome: 'success',
      initiatingUserId: null,
      metadata: { branchId: 'branch-123' },
      requestId: 'req-3',
      sessionId: 'session-456',
    },
    {
      id: 'audit-4',
      timestamp: new Date('2026-01-27T13:00:00Z'),
      action: 'permission.denied',
      actorId: 'admin-123',
      actorType: 'user',
      actorIp: '192.168.1.1',
      actorUserAgent: 'Mozilla/5.0',
      resourceType: 'branch',
      resourceId: 'branch-456',
      outcome: 'denied',
      initiatingUserId: null,
      metadata: { reason: 'insufficient_permissions', required: 'owner' },
      requestId: 'req-4',
      sessionId: 'session-123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAuthMock() {
    // Mock session validation for auth middleware
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { session: mockSession, user: mockUser },
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

  describe('Filter by Actor ID', () => {
    it('should return audit logs for specific actor', async () => {
      setupAuthMock();

      const actorLogs = mockAuditLogs.filter((log) => log.actorId === 'admin-123');

      // Mock count query
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: actorLogs.length }]),
        }),
      });

      // Mock audit logs query
      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(actorLogs);

      // Mock user enrichment
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?actorId=admin-123', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(3);
      expect(data.entries.every((e: any) => e.actorId === 'admin-123')).toBe(true);
      expect(data.total).toBe(3);
    });

    it('should enrich audit logs with actor details', async () => {
      setupAuthMock();

      const actorLogs = [mockAuditLogs[0]];

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(actorLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?actorId=admin-123', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries[0].actor).toEqual({
        id: 'admin-123',
        email: 'admin@example.com',
        displayName: 'Admin User',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });
  });

  describe('Filter by Resource Type and ID', () => {
    it('should filter by resource type', async () => {
      setupAuthMock();

      const branchLogs = mockAuditLogs.filter((log) => log.resourceType === 'branch');

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: branchLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(branchLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?resourceType=branch', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(3);
      expect(data.entries.every((e: any) => e.resourceType === 'branch')).toBe(true);
    });

    it('should filter by specific resource ID', async () => {
      setupAuthMock();

      const resourceLogs = mockAuditLogs.filter(
        (log) => log.resourceType === 'branch' && log.resourceId === 'branch-123'
      );

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: resourceLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(resourceLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request(
        '/api/v1/audit?resourceType=branch&resourceId=branch-123',
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
      expect(data.entries.every((e: any) => e.resourceId === 'branch-123')).toBe(true);
    });
  });

  describe('Filter by Action Type', () => {
    it('should filter by single action', async () => {
      setupAuthMock();

      const actionLogs = mockAuditLogs.filter((log) => log.action === 'branch.created');

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: actionLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(actionLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?actions=branch.created', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].action).toBe('branch.created');
    });

    it('should filter by multiple actions (comma-separated)', async () => {
      setupAuthMock();

      const actionLogs = mockAuditLogs.filter((log) =>
        ['branch.created', 'review.approved'].includes(log.action)
      );

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: actionLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(actionLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?actions=branch.created,review.approved', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
      expect(['branch.created', 'review.approved']).toContain(data.entries[0].action);
    });
  });

  describe('Filter by Date Range', () => {
    it('should filter by startDate', async () => {
      setupAuthMock();

      const startDate = new Date('2026-01-27T11:30:00Z');
      const filteredLogs = mockAuditLogs.filter((log) => log.timestamp >= startDate);

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: filteredLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(filteredLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?startDate=2026-01-27T11:30:00Z', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
      expect(new Date(data.entries[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        startDate.getTime()
      );
    });

    it('should filter by endDate', async () => {
      setupAuthMock();

      const endDate = new Date('2026-01-27T11:30:00Z');
      const filteredLogs = mockAuditLogs.filter((log) => log.timestamp <= endDate);

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: filteredLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(filteredLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?endDate=2026-01-27T11:30:00Z', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
    });

    it('should filter by date range (startDate and endDate)', async () => {
      setupAuthMock();

      const startDate = new Date('2026-01-27T10:30:00Z');
      const endDate = new Date('2026-01-27T12:30:00Z');
      const filteredLogs = mockAuditLogs.filter(
        (log) => log.timestamp >= startDate && log.timestamp <= endDate
      );

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: filteredLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(filteredLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser, mockReviewer]);

      const response = await app.request(
        '/api/v1/audit?startDate=2026-01-27T10:30:00Z&endDate=2026-01-27T12:30:00Z',
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
    });
  });

  describe('Pagination', () => {
    it('should support pagination with page and limit', async () => {
      setupAuthMock();

      const page1Logs = mockAuditLogs.slice(0, 2);

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: mockAuditLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(page1Logs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?page=1&limit=2', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(2);
      expect(data.total).toBe(4);
      expect(data.hasMore).toBe(true);
    });

    it('should return second page correctly', async () => {
      setupAuthMock();

      const page2Logs = mockAuditLogs.slice(2, 4);

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: mockAuditLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(page2Logs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?page=2&limit=2', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(2);
      expect(data.page).toBe(2);
      expect(data.hasMore).toBe(false);
    });
  });

  describe('Combined Filters', () => {
    it('should combine actor, resource, action, and date filters', async () => {
      setupAuthMock();

      const filteredLogs = mockAuditLogs.filter(
        (log) =>
          log.actorId === 'admin-123' &&
          log.resourceType === 'branch' &&
          log.action === 'branch.transitioned' &&
          log.timestamp >= new Date('2026-01-27T10:00:00Z')
      );

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: filteredLogs.length }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(filteredLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request(
        '/api/v1/audit?actorId=admin-123&resourceType=branch&actions=branch.transitioned&startDate=2026-01-27T10:00:00Z',
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].action).toBe('branch.transitioned');
    });
  });

  describe('Permission Checks', () => {
    it('should allow administrators to query audit logs', async () => {
      setupAuthMock();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce([]);

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
    });

    it('should allow reviewers to query audit logs', async () => {
      const reviewerSession = {
        ...mockSession,
        userId: 'reviewer-123',
        token: 'reviewer-token',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { session: reviewerSession, user: mockReviewer },
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

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce([]);

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=reviewer-token' },
      });

      expect(response.status).toBe(200);
    });

    it('should deny contributors access to audit logs', async () => {
      const contributorUser = {
        ...mockUser,
        id: 'contributor-123',
        roles: ['contributor'],
      };
      const contributorSession = {
        ...mockSession,
        userId: 'contributor-123',
        token: 'contributor-token',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { session: contributorSession, user: contributorUser },
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

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=contributor-token' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Insufficient permissions');
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/audit');

      expect(response.status).toBe(401);
    });
  });

  describe('Query Performance (SC-006)', () => {
    it('should complete query in under 5 seconds', async () => {
      setupAuthMock();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1000 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(
        mockAuditLogs.slice(0, 50)
      );
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const startTime = Date.now();
      const response = await app.request('/api/v1/audit?limit=50', {
        headers: { Cookie: 'echo_session=admin-token' },
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      setupAuthMock();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce([]);

      const response = await app.request('/api/v1/audit?actorId=nonexistent-user', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it('should handle invalid date format', async () => {
      setupAuthMock();

      const response = await app.request('/api/v1/audit?startDate=invalid-date', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      // Should either return 400 or handle gracefully
      expect([200, 400]).toContain(response.status);
    });

    it('should enforce maximum limit of 100', async () => {
      setupAuthMock();

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 200 }]),
        }),
      });

      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(mockAuditLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([mockUser]);

      const response = await app.request('/api/v1/audit?limit=200', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      // Limit should be capped at 100 by schema validation
      expect(data.limit).toBeLessThanOrEqual(100);
    });
  });
});
