import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
  invalidateUserSessionCache: vi.fn(),
}));

// Mock database — include schema for endpoints that query db directly (e.g. admin/metrics)
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
  schema: {
    notifications: {
      id: 'id',
      userId: 'userId',
      type: 'type',
      category: 'category',
      title: 'title',
      message: 'message',
      resourceType: 'resourceType',
      resourceId: 'resourceId',
      actorId: 'actorId',
      isRead: 'isRead',
      createdAt: 'createdAt',
      readAt: 'readAt',
    },
  },
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    markAllRead: vi.fn(),
    markRead: vi.fn(),
    getPreferences: vi.fn(),
    updatePreference: vi.fn(),
  },
}));

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';
import { notificationService } from '../../src/services/notification/notification-service';

const UUID_USER = '00000000-0000-4000-a000-000000000001';
const UUID_NOTIFICATION_1 = '00000000-0000-4000-a000-000000000010';
const UUID_NOTIFICATION_2 = '00000000-0000-4000-a000-000000000011';
const UUID_NONEXISTENT = '00000000-0000-4000-a000-000000000099';

const mockUser = {
  id: UUID_USER,
  externalId: 'github-test',
  provider: 'github',
  email: 'test@example.com',
  displayName: 'Test User',
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

function selectChain(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('Notification API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup validateSession to return a valid session
    (validateSession as any).mockResolvedValue({
      userId: UUID_USER,
      role: 'contributor',
      id: 'session-1',
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Setup db.select chain for auth middleware user lookup
    (db.select as any).mockReturnValue(selectChain([mockUser]));
  });

  // ---------- GET /api/v1/notifications ----------

  describe('GET /api/v1/notifications', () => {
    const mockNotifications = [
      {
        id: UUID_NOTIFICATION_1,
        type: 'review_requested',
        category: 'review',
        title: 'Review requested',
        message: 'Your review has been requested on Branch A',
        resourceType: 'branch',
        resourceId: '00000000-0000-4000-a000-000000000020',
        actorId: '00000000-0000-4000-a000-000000000002',
        actorName: 'Other User',
        isRead: false,
        createdAt: '2026-02-13T00:00:00.000Z',
        readAt: undefined,
      },
      {
        id: UUID_NOTIFICATION_2,
        type: 'branch_published',
        category: 'lifecycle',
        title: 'Branch published',
        message: 'Branch B has been published',
        resourceType: 'branch',
        resourceId: '00000000-0000-4000-a000-000000000021',
        actorId: undefined,
        actorName: undefined,
        isRead: true,
        createdAt: '2026-02-12T00:00:00.000Z',
        readAt: '2026-02-12T12:00:00.000Z',
      },
    ];

    it('should return paginated list of notifications', async () => {
      (notificationService.list as any).mockResolvedValue({
        items: mockNotifications,
        total: 2,
      });

      const res = await app.request('/api/v1/notifications', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(20);
      expect(body.meta.hasMore).toBe(false);
    });

    it('should pass page and limit query params to the service', async () => {
      (notificationService.list as any).mockResolvedValue({
        items: [mockNotifications[0]],
        total: 2,
      });

      const res = await app.request('/api/v1/notifications?page=2&limit=1', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.page).toBe(2);
      expect(body.meta.limit).toBe(1);
      expect(notificationService.list).toHaveBeenCalledWith(
        UUID_USER,
        expect.objectContaining({ page: 2, limit: 1 })
      );
    });

    it('should filter by category when provided', async () => {
      (notificationService.list as any).mockResolvedValue({
        items: [mockNotifications[0]],
        total: 1,
      });

      const res = await app.request('/api/v1/notifications?category=review', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      expect(notificationService.list).toHaveBeenCalledWith(
        UUID_USER,
        expect.objectContaining({ category: 'review' })
      );
    });

    it('should filter by isRead when provided', async () => {
      (notificationService.list as any).mockResolvedValue({
        items: [],
        total: 0,
      });

      const res = await app.request('/api/v1/notifications?isRead=false', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      expect(notificationService.list).toHaveBeenCalledWith(
        UUID_USER,
        expect.objectContaining({ isRead: false })
      );
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications');

      expect(res.status).toBe(401);
    });

    it('should return empty list when no notifications exist', async () => {
      (notificationService.list as any).mockResolvedValue({
        items: [],
        total: 0,
      });

      const res = await app.request('/api/v1/notifications', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });
  });

  // ---------- GET /api/v1/notifications/unread-count ----------

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(5);

      const res = await app.request('/api/v1/notifications/unread-count', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.count).toBe(5);
    });

    it('should return zero when no unread notifications', async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(0);

      const res = await app.request('/api/v1/notifications/unread-count', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.count).toBe(0);
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/unread-count');

      expect(res.status).toBe(401);
    });
  });

  // ---------- POST /api/v1/notifications/mark-all-read ----------

  describe('POST /api/v1/notifications/mark-all-read', () => {
    it('should mark all notifications as read and return count', async () => {
      (notificationService.markAllRead as any).mockResolvedValue(3);

      const res = await app.request('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.count).toBe(3);
      expect(notificationService.markAllRead).toHaveBeenCalledWith(UUID_USER);
    });

    it('should return zero count when no unread notifications', async () => {
      (notificationService.markAllRead as any).mockResolvedValue(0);

      const res = await app.request('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.count).toBe(0);
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/mark-all-read', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
    });
  });

  // ---------- GET /api/v1/notifications/preferences ----------

  describe('GET /api/v1/notifications/preferences', () => {
    const mockPreferences = [
      { category: 'review', enabled: true },
      { category: 'lifecycle', enabled: true },
      { category: 'ai', enabled: false },
    ];

    it('should return notification preferences for all 3 categories', async () => {
      (notificationService.getPreferences as any).mockResolvedValue(mockPreferences);

      const res = await app.request('/api/v1/notifications/preferences', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(3);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'review', enabled: true }),
          expect.objectContaining({ category: 'lifecycle', enabled: true }),
          expect.objectContaining({ category: 'ai', enabled: false }),
        ])
      );
    });

    it('should call getPreferences with the authenticated user ID', async () => {
      (notificationService.getPreferences as any).mockResolvedValue(mockPreferences);

      await app.request('/api/v1/notifications/preferences', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(notificationService.getPreferences).toHaveBeenCalledWith(UUID_USER);
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/preferences');

      expect(res.status).toBe(401);
    });
  });

  // ---------- PATCH /api/v1/notifications/preferences ----------

  describe('PATCH /api/v1/notifications/preferences', () => {
    it('should update a notification preference', async () => {
      (notificationService.updatePreference as any).mockResolvedValue({
        category: 'review',
        enabled: false,
      });

      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'review', enabled: false }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.category).toBe('review');
      expect(body.data.enabled).toBe(false);
      expect(notificationService.updatePreference).toHaveBeenCalledWith(
        UUID_USER,
        'review',
        false
      );
    });

    it('should accept all valid category values', async () => {
      for (const category of ['review', 'lifecycle', 'ai']) {
        vi.clearAllMocks();
        (validateSession as any).mockResolvedValue({
          userId: UUID_USER,
          role: 'contributor',
          id: 'session-1',
          expiresAt: new Date(Date.now() + 86400000),
        });
        (db.select as any).mockReturnValue(selectChain([mockUser]));
        (notificationService.updatePreference as any).mockResolvedValue({
          category,
          enabled: true,
        });

        const res = await app.request('/api/v1/notifications/preferences', {
          method: 'PATCH',
          headers: {
            Cookie: 'echo_session=test-session-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category, enabled: true }),
        });

        expect(res.status).toBe(200);
      }
    });

    it('should reject invalid category enum value', async () => {
      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'invalid_category', enabled: true }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject non-boolean enabled value', async () => {
      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'review', enabled: 'yes' }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing category field', async () => {
      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing enabled field', async () => {
      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'review' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'review', enabled: false }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ---------- PATCH /api/v1/notifications/:notificationId/read ----------

  describe('PATCH /api/v1/notifications/:notificationId/read', () => {
    const mockReadNotification = {
      id: UUID_NOTIFICATION_1,
      type: 'review_requested',
      category: 'review',
      title: 'Review requested',
      message: 'Your review has been requested',
      isRead: true,
      createdAt: '2026-02-13T00:00:00.000Z',
      readAt: '2026-02-13T12:00:00.000Z',
    };

    it('should mark a notification as read and return it', async () => {
      (notificationService.markRead as any).mockResolvedValue(mockReadNotification);

      const res = await app.request(
        `/api/v1/notifications/${UUID_NOTIFICATION_1}/read`,
        {
          method: 'PATCH',
          headers: { Cookie: 'echo_session=test-session-token' },
        }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(UUID_NOTIFICATION_1);
      expect(body.data.isRead).toBe(true);
      expect(body.data.readAt).toBeDefined();
      expect(notificationService.markRead).toHaveBeenCalledWith(
        UUID_NOTIFICATION_1,
        UUID_USER
      );
    });

    it('should return 404 when notification not found or not owned by user', async () => {
      (notificationService.markRead as any).mockResolvedValue(null);

      const res = await app.request(
        `/api/v1/notifications/${UUID_NONEXISTENT}/read`,
        {
          method: 'PATCH',
          headers: { Cookie: 'echo_session=test-session-token' },
        }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('not found');
    });

    it('should reject invalid UUID format in param', async () => {
      const res = await app.request(
        '/api/v1/notifications/not-a-valid-uuid/read',
        {
          method: 'PATCH',
          headers: { Cookie: 'echo_session=test-session-token' },
        }
      );

      expect(res.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request(
        `/api/v1/notifications/${UUID_NOTIFICATION_1}/read`,
        {
          method: 'PATCH',
        }
      );

      expect(res.status).toBe(401);
    });
  });

  // ---------- GET /api/v1/notifications/admin/metrics ----------

  describe('GET /api/v1/notifications/admin/metrics', () => {
    const adminUser = { ...mockUser, roles: ['administrator'] };

    function groupByChain(result: any[]) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue(result),
          }),
        }),
      };
    }

    it('should return 403 when user is not an administrator', async () => {
      // Default mockUser has roles: ['contributor'] — no override needed
      const res = await app.request('/api/v1/notifications/admin/metrics', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Administrator role required');
    });

    it('should return 200 with correct metrics structure for admin', async () => {
      // Override auth to return admin user
      (validateSession as any).mockResolvedValue({
        userId: UUID_USER,
        role: 'administrator',
        id: 'session-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const mockRows24h = [
        { type: 'review_requested', count: 5 },
        { type: 'branch_published', count: 3 },
      ];
      const mockRows7d = [
        { type: 'review_requested', count: 12 },
        { type: 'branch_published', count: 8 },
        { type: 'review_approved', count: 4 },
      ];
      const mockRows30d = [
        { type: 'review_requested', count: 30 },
        { type: 'branch_published', count: 20 },
        { type: 'review_approved', count: 15 },
        { type: 'ai_generation_complete', count: 10 },
      ];

      (db.select as any)
        .mockReturnValueOnce(selectChain([adminUser])) // auth middleware
        .mockReturnValueOnce(groupByChain(mockRows24h)) // 24h aggregation
        .mockReturnValueOnce(groupByChain(mockRows7d)) // 7d aggregation
        .mockReturnValueOnce(groupByChain(mockRows30d)); // 30d aggregation

      const res = await app.request('/api/v1/notifications/admin/metrics', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.periods).toBeDefined();

      // Verify 24h period
      expect(body.data.periods['24h'].total).toBe(8);
      expect(body.data.periods['24h'].byType).toEqual({
        review_requested: 5,
        branch_published: 3,
      });

      // Verify 7d period
      expect(body.data.periods['7d'].total).toBe(24);
      expect(body.data.periods['7d'].byType).toEqual({
        review_requested: 12,
        branch_published: 8,
        review_approved: 4,
      });

      // Verify 30d period
      expect(body.data.periods['30d'].total).toBe(75);
      expect(body.data.periods['30d'].byType).toEqual({
        review_requested: 30,
        branch_published: 20,
        review_approved: 15,
        ai_generation_complete: 10,
      });
    });

    it('should return empty periods with all zeros when no notifications exist', async () => {
      (validateSession as any).mockResolvedValue({
        userId: UUID_USER,
        role: 'administrator',
        id: 'session-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      (db.select as any)
        .mockReturnValueOnce(selectChain([adminUser])) // auth middleware
        .mockReturnValueOnce(groupByChain([])) // 24h — no rows
        .mockReturnValueOnce(groupByChain([])) // 7d — no rows
        .mockReturnValueOnce(groupByChain([])); // 30d — no rows

      const res = await app.request('/api/v1/notifications/admin/metrics', {
        headers: { Cookie: 'echo_session=test-session-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.periods).toBeDefined();
      expect(body.data.periods['24h']).toEqual({ total: 0, byType: {} });
      expect(body.data.periods['7d']).toEqual({ total: 0, byType: {} });
      expect(body.data.periods['30d']).toEqual({ total: 0, byType: {} });
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/admin/metrics');

      expect(res.status).toBe(401);
    });
  });
});
