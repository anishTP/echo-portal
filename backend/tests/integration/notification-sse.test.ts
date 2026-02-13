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

// Mock notification SSE
vi.mock('../../src/services/notification/notification-sse', () => ({
  notificationSSE: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn().mockResolvedValue(undefined),
    publishCount: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../../src/db';
import { validateSession } from '../../src/services/auth/session';
import { notificationService } from '../../src/services/notification/notification-service';
import { notificationSSE } from '../../src/services/notification/notification-sse';

const UUID_USER = '00000000-0000-4000-a000-000000000001';

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

describe('Notification SSE Integration Tests', () => {
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

    // Default: getUnreadCount returns 0, list returns empty
    (notificationService.getUnreadCount as any).mockResolvedValue(0);
    (notificationService.list as any).mockResolvedValue({ items: [], total: 0 });
  });

  describe('GET /api/v1/notifications/stream', () => {
    it('should return 200 with text/event-stream content type for authenticated user', async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(3);

      const controller = new AbortController();
      const responsePromise = app.request('/api/v1/notifications/stream', {
        headers: { Cookie: 'echo_session=test-session-token' },
        signal: controller.signal,
      });

      // The response is available immediately even though the stream is still open
      const res = await responsePromise;

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      // Abort to clean up the streaming connection
      controller.abort();
    });

    it('should return 401 when not authenticated', async () => {
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/notifications/stream');

      expect(res.status).toBe(401);
    });

    it('should call notificationSSE.subscribe with the user ID', async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(0);

      const controller = new AbortController();
      const res = await app.request('/api/v1/notifications/stream', {
        headers: { Cookie: 'echo_session=test-session-token' },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);

      // Read a small chunk to ensure the stream callback has executed
      const reader = res.body!.getReader();
      // Read the first chunk (initial count event)
      await reader.read();

      expect(notificationSSE.subscribe).toHaveBeenCalledWith(
        UUID_USER,
        expect.any(Object)
      );

      controller.abort();
      reader.releaseLock();
    });

    it('should call getUnreadCount for initial count delivery', async () => {
      (notificationService.getUnreadCount as any).mockResolvedValue(7);

      const controller = new AbortController();
      const res = await app.request('/api/v1/notifications/stream', {
        headers: { Cookie: 'echo_session=test-session-token' },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);

      // Read first chunk to let the stream handler execute
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(UUID_USER);

      // The initial SSE event should contain the count
      expect(text).toContain('event: count');
      expect(text).toContain('"count":7');

      controller.abort();
      reader.releaseLock();
    });

    it('should trigger catch-up by calling list when Last-Event-ID header is provided', async () => {
      const lastEventId = '00000000-0000-4000-a000-000000000050';
      const missedNotification = {
        id: '00000000-0000-4000-a000-000000000051',
        type: 'review_requested',
        category: 'review',
        title: 'Missed notification',
        message: 'You missed this while offline',
        resourceType: 'branch',
        resourceId: '00000000-0000-4000-a000-000000000020',
        actorId: '00000000-0000-4000-a000-000000000002',
        actorName: 'Other User',
        isRead: false,
        createdAt: '2026-02-13T01:00:00.000Z',
        readAt: undefined,
      };

      (notificationService.getUnreadCount as any).mockResolvedValue(1);
      (notificationService.list as any).mockResolvedValue({
        items: [missedNotification, { ...missedNotification, id: lastEventId }],
        total: 2,
      });

      const controller = new AbortController();
      const res = await app.request('/api/v1/notifications/stream', {
        headers: {
          Cookie: 'echo_session=test-session-token',
          'Last-Event-ID': lastEventId,
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);

      // Read enough data to let the catch-up logic execute
      const reader = res.body!.getReader();
      const chunks: string[] = [];

      // Read chunks until we have the catch-up data or hit a reasonable limit
      for (let i = 0; i < 5; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
        // Stop once we see the notification event from catch-up
        if (chunks.join('').includes('event: notification')) break;
      }

      expect(notificationService.list).toHaveBeenCalledWith(
        UUID_USER,
        expect.objectContaining({ page: 1, limit: 50 })
      );

      controller.abort();
      reader.releaseLock();
    });
  });
});
