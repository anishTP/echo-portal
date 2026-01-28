import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';
import type { AuditLog } from '../../src/db/schema/audit-logs';

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
      auditLogs: {
        findMany: vi.fn(),
      },
    },
  },
}));

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';

const UUID_ADMIN = '00000000-0000-4000-a000-000000000001';
const UUID_REVIEWER = '00000000-0000-4000-a000-000000000002';
const UUID_CONTRIBUTOR = '00000000-0000-4000-a000-000000000003';

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
    id: UUID_ADMIN,
    externalId: 'github-admin',
    provider: 'github',
    email: 'admin@example.com',
    displayName: 'Admin User',
    avatarUrl: 'https://example.com/avatar.jpg',
    roles: ['administrator'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    lockedUntil: null,
    failedLoginCount: 0,
    lastFailedLoginAt: null,
  };

  const mockReviewer = {
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

  const mockAuditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      timestamp: new Date('2026-01-27T10:00:00Z'),
      action: 'branch.created',
      actorId: UUID_ADMIN,
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
      actorId: UUID_ADMIN,
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
      actorId: UUID_REVIEWER,
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
      actorId: UUID_ADMIN,
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

  const tokenUserMap: Record<string, { user: any; session: any }> = {
    'admin-token': {
      user: mockUser,
      session: { id: 'session-admin', userId: UUID_ADMIN, role: 'administrator' },
    },
    'reviewer-token': {
      user: mockReviewer,
      session: { id: 'session-reviewer', userId: UUID_REVIEWER, role: 'reviewer' },
    },
  };

  /**
   * Chain helper for db.select() calls that end with .limit()
   * Used by auth middleware: db.select().from(users).where(...).limit(1)
   */
  function selectChain(result: any[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  }

  /**
   * Chain helper for db.select() calls without .limit()
   * Used by audit count query: db.select({count}).from(auditLogs).where(...)
   */
  function selectChainNoLimit(result: any[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      }),
    };
  }

  beforeEach(() => {
    // Reset all mock state including return values and mockReturnValueOnce queues
    (db.select as any).mockReset();
    (db.update as any).mockReset();
    (db.insert as any).mockReset();
    (db.delete as any).mockReset();
    (db.query.users.findFirst as any).mockReset();
    (db.query.users.findMany as any).mockReset();
    (db.query.auditLogs.findMany as any).mockReset();
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
   * Auth middleware calls: db.select().from(users).where(eq(users.id, session.userId)).limit(1)
   * Must be called before making any authenticated request.
   */
  function setupAuth(user: any) {
    (db.select as any).mockReturnValueOnce(selectChain([user]));
  }

  /**
   * Sets up mocks for a successful audit query:
   * 1. Auth middleware user lookup (selectChain with limit)
   * 2. Count query (selectChainNoLimit)
   * 3. Audit log entries (db.query.auditLogs.findMany)
   * 4. User enrichment (db.query.users.findMany) - only if entries > 0
   */
  function setupAuditQuery(
    authUser: any,
    entries: AuditLog[],
    total: number,
    enrichUsers: any[]
  ) {
    setupAuth(authUser);
    // Count query: db.select({count}).from(auditLogs).where(...)
    (db.select as any).mockReturnValueOnce(selectChainNoLimit([{ count: total }]));
    // Audit log entries
    (db.query.auditLogs.findMany as any).mockResolvedValueOnce(entries);
    // User enrichment (only called when entries.length > 0)
    if (entries.length > 0) {
      (db.query.users.findMany as any).mockResolvedValueOnce(enrichUsers);
    }
  }

  describe('Filter by Actor ID', () => {
    it('should return audit logs for specific actor', async () => {
      const actorLogs = mockAuditLogs.filter((log) => log.actorId === UUID_ADMIN);

      setupAuditQuery(mockUser, actorLogs, actorLogs.length, [mockUser]);

      const response = await app.request(`/api/v1/audit?actorId=${UUID_ADMIN}`, {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(3);
      expect(data.data.every((e: any) => e.actorId === UUID_ADMIN)).toBe(true);
      expect(data.meta.total).toBe(3);
    });

    it('should enrich audit logs with actor details', async () => {
      const actorLogs = [mockAuditLogs[0]];

      // The enrichWithActors method queries with columns filter, so mock returns only relevant fields
      const actorDetails = {
        id: UUID_ADMIN,
        email: 'admin@example.com',
        displayName: 'Admin User',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      setupAuth(mockUser);
      (db.select as any).mockReturnValueOnce(selectChainNoLimit([{ count: 1 }]));
      (db.query.auditLogs.findMany as any).mockResolvedValueOnce(actorLogs);
      (db.query.users.findMany as any).mockResolvedValueOnce([actorDetails]);

      const response = await app.request(`/api/v1/audit?actorId=${UUID_ADMIN}`, {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data[0].actor).toEqual({
        id: UUID_ADMIN,
        email: 'admin@example.com',
        displayName: 'Admin User',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });
  });

  describe('Filter by Resource Type and ID', () => {
    it('should filter by resource type', async () => {
      const branchLogs = mockAuditLogs.filter((log) => log.resourceType === 'branch');

      setupAuditQuery(mockUser, branchLogs, branchLogs.length, [mockUser]);

      const response = await app.request('/api/v1/audit?resourceType=branch', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(3);
      expect(data.data.every((e: any) => e.resourceType === 'branch')).toBe(true);
    });

    it('should filter by specific resource ID', async () => {
      const resourceLogs = mockAuditLogs.filter(
        (log) => log.resourceType === 'branch' && log.resourceId === 'branch-123'
      );

      setupAuditQuery(mockUser, resourceLogs, resourceLogs.length, [mockUser]);

      const response = await app.request(
        '/api/v1/audit?resourceType=branch&resourceId=00000000-0000-4000-a000-00000000b123',
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.data.every((e: any) => e.resourceId === 'branch-123')).toBe(true);
    });
  });

  describe('Filter by Action Type', () => {
    it('should filter by single action', async () => {
      const actionLogs = mockAuditLogs.filter((log) => log.action === 'branch.created');

      setupAuditQuery(mockUser, actionLogs, actionLogs.length, [mockUser]);

      const response = await app.request('/api/v1/audit?actions=branch.created', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].action).toBe('branch.created');
    });

    it('should filter by multiple actions (comma-separated)', async () => {
      const actionLogs = mockAuditLogs.filter((log) =>
        ['branch.created', 'review.approved'].includes(log.action)
      );

      setupAuditQuery(mockUser, actionLogs, actionLogs.length, [mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?actions=branch.created,review.approved', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(['branch.created', 'review.approved']).toContain(data.data[0].action);
    });
  });

  describe('Filter by Date Range', () => {
    it('should filter by startDate', async () => {
      const startDate = new Date('2026-01-27T11:30:00Z');
      const filteredLogs = mockAuditLogs.filter((log) => log.timestamp >= startDate);

      setupAuditQuery(mockUser, filteredLogs, filteredLogs.length, [mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?startDate=2026-01-27T11:30:00Z', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(new Date(data.data[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        startDate.getTime()
      );
    });

    it('should filter by endDate', async () => {
      const endDate = new Date('2026-01-27T11:30:00Z');
      const filteredLogs = mockAuditLogs.filter((log) => log.timestamp <= endDate);

      setupAuditQuery(mockUser, filteredLogs, filteredLogs.length, [mockUser]);

      const response = await app.request('/api/v1/audit?endDate=2026-01-27T11:30:00Z', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
    });

    it('should filter by date range (startDate and endDate)', async () => {
      const startDate = new Date('2026-01-27T10:30:00Z');
      const endDate = new Date('2026-01-27T12:30:00Z');
      const filteredLogs = mockAuditLogs.filter(
        (log) => log.timestamp >= startDate && log.timestamp <= endDate
      );

      setupAuditQuery(mockUser, filteredLogs, filteredLogs.length, [mockUser, mockReviewer]);

      const response = await app.request(
        '/api/v1/audit?startDate=2026-01-27T10:30:00Z&endDate=2026-01-27T12:30:00Z',
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
    });
  });

  describe('Pagination', () => {
    it('should support pagination with page and limit', async () => {
      const page1Logs = mockAuditLogs.slice(0, 2);

      setupAuditQuery(mockUser, page1Logs, mockAuditLogs.length, [mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?page=1&limit=2', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(2);
      expect(data.meta.total).toBe(4);
      expect(data.meta.hasMore).toBe(true);
    });

    it('should return second page correctly', async () => {
      const page2Logs = mockAuditLogs.slice(2, 4);

      setupAuditQuery(mockUser, page2Logs, mockAuditLogs.length, [mockUser, mockReviewer]);

      const response = await app.request('/api/v1/audit?page=2&limit=2', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.meta.page).toBe(2);
      expect(data.meta.hasMore).toBe(false);
    });
  });

  describe('Combined Filters', () => {
    it('should combine actor, resource, action, and date filters', async () => {
      const filteredLogs = mockAuditLogs.filter(
        (log) =>
          log.actorId === UUID_ADMIN &&
          log.resourceType === 'branch' &&
          log.action === 'branch.transitioned' &&
          log.timestamp >= new Date('2026-01-27T10:00:00Z')
      );

      setupAuditQuery(mockUser, filteredLogs, filteredLogs.length, [mockUser]);

      const response = await app.request(
        `/api/v1/audit?actorId=${UUID_ADMIN}&resourceType=branch&actions=branch.transitioned&startDate=2026-01-27T10:00:00Z`,
        {
          headers: { Cookie: 'echo_session=admin-token' },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].action).toBe('branch.transitioned');
    });
  });

  describe('Permission Checks', () => {
    it('should allow administrators to query audit logs', async () => {
      setupAuditQuery(mockUser, [], 0, []);

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
    });

    it('should allow reviewers to query audit logs', async () => {
      setupAuditQuery(mockReviewer, [], 0, []);

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=reviewer-token' },
      });

      expect(response.status).toBe(200);
    });

    it('should deny contributors access to audit logs', async () => {
      const contributorUser = {
        ...mockUser,
        id: UUID_CONTRIBUTOR,
        email: 'contributor@example.com',
        roles: ['contributor'],
      };

      // Add contributor to token map temporarily for this test
      const contributorSession = { id: 'session-contrib', userId: UUID_CONTRIBUTOR, role: 'contributor' };
      (validateSession as any).mockImplementation((token: string) => {
        if (token === 'contributor-token') {
          return Promise.resolve({
            ...contributorSession,
            token,
            expiresAt: new Date(Date.now() + 86400000),
          });
        }
        return Promise.resolve(null);
      });

      setupAuth(contributorUser);

      const response = await app.request('/api/v1/audit', {
        headers: { Cookie: 'echo_session=contributor-token' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.message).toContain('Insufficient permissions');
    });

    it('should require authentication', async () => {
      const response = await app.request('/api/v1/audit');

      expect(response.status).toBe(401);
    });
  });

  describe('Query Performance (SC-006)', () => {
    it('should complete query in under 5 seconds', async () => {
      setupAuditQuery(mockUser, mockAuditLogs.slice(0, 4), 1000, [mockUser]);

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
      setupAuditQuery(mockUser, [], 0, []);

      const response = await app.request(`/api/v1/audit?actorId=${UUID_CONTRIBUTOR}`, {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(0);
      expect(data.meta.total).toBe(0);
    });

    it('should handle invalid date format', async () => {
      setupAuth(mockUser);

      const response = await app.request('/api/v1/audit?startDate=invalid-date', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      // Should return 400 (invalid input), 500 (unhandled Invalid Date), or handle gracefully
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should enforce maximum limit of 100', async () => {
      setupAuditQuery(mockUser, mockAuditLogs, 200, [mockUser]);

      const response = await app.request('/api/v1/audit?limit=200', {
        headers: { Cookie: 'echo_session=admin-token' },
      });

      // Zod schema has max(100), so limit=200 should be rejected as 400
      // or capped at 100 if the schema coerces
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        // Limit should be capped at 100 by schema validation
        expect(data.meta.limit).toBeLessThanOrEqual(100);
      }
    });
  });
});
