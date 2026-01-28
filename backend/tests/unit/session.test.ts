import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeSessionByToken,
  revokeAllUserSessions,
  getUserSessions,
  cleanupExpiredSessions,
  invalidateUserSessionCache,
} from '../../src/services/auth/session';

// Mock the database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock the schema
vi.mock('../../src/db/schema', () => ({
  sessions: {
    id: 'id',
    userId: 'userId',
    token: 'token',
    provider: 'provider',
    expiresAt: 'expiresAt',
    userAgent: 'userAgent',
    ipAddress: 'ipAddress',
    lastActivityAt: 'lastActivityAt',
    createdAt: 'createdAt',
    revokedAt: 'revokedAt',
  },
  users: {
    id: 'id',
    roles: 'roles',
    lockedUntil: 'lockedUntil',
  },
}));

import { db } from '../../src/db';

describe('Session Service - Unit Tests (T028)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('createSession', () => {
    it('should create a new session with 24h expiry', async () => {
      const userId = 'user-123';
      const provider = 'github';
      const userAgent = 'Mozilla/5.0';
      const ipAddress = '192.168.1.1';

      const mockSession = {
        id: 'session-123',
        userId,
        token: 'token-abc',
        provider,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userAgent,
        ipAddress,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: userId,
        roles: ['contributor'],
      };

      // Mock insert returning session
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      });

      // Mock select returning user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const session = await createSession(userId, provider, userAgent, ipAddress);

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.provider).toBe(provider);
      expect(session.role).toBe('contributor');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent-user';
      const provider = 'github';

      const mockSession = {
        id: 'session-123',
        userId,
        token: 'token-abc',
        provider,
        expiresAt: new Date(),
        userAgent: null,
        ipAddress: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(createSession(userId, provider)).rejects.toThrow('User not found');
    });
  });

  describe('validateSession', () => {
    it('should validate and return active session', async () => {
      const token = 'valid-token';
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token,
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future date
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const session = await validateSession(token);

      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-123');
      expect(session?.role).toBe('contributor');
    });

    it('should return null for expired session', async () => {
      const token = 'expired-token';
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token,
        provider: 'github',
        expiresAt: new Date(Date.now() - 1000), // Past date
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      // First call: validateSession (uses innerJoin)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      // Second call: revokeSession looks up session by id (no innerJoin)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSession]),
          }),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      const session = await validateSession(token);

      expect(session).toBeNull();
      expect(db.delete).toHaveBeenCalled();
    });

    it('should return null for locked user account', async () => {
      const token = 'locked-user-token';
      const mockSession = {
        id: 'session-locked',
        userId: 'user-123',
        token,
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // Locked for 15 more minutes
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      const session = await validateSession(token);

      expect(session).toBeNull();
    });

    it('should return null for nonexistent session', async () => {
      const token = 'nonexistent-token';

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const session = await validateSession(token);

      expect(session).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should revoke session by id', async () => {
      const sessionId = 'session-123';

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: sessionId,
                token: 'token-abc',
              },
            ]),
          }),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      await revokeSession(sessionId);

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('revokeSessionByToken', () => {
    it('should revoke session by token', async () => {
      const token = 'token-abc';

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      await revokeSessionByToken(token);

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for a user', async () => {
      const userId = 'user-123';

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'session-1', token: 'token-1' },
            { id: 'session-2', token: 'token-2' },
          ]),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      await revokeAllUserSessions(userId);

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should return all active sessions for user', async () => {
      const userId = 'user-123';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const mockSessions = [
        {
          session: {
            id: 'session-1',
            userId,
            token: 'token-1',
            provider: 'github',
            expiresAt: futureDate,
            userAgent: 'Mozilla/5.0',
            ipAddress: '192.168.1.1',
            lastActivityAt: new Date(),
            createdAt: new Date(),
            revokedAt: null,
          },
          user: {
            id: userId,
            roles: ['contributor'],
          },
        },
        {
          session: {
            id: 'session-2',
            userId,
            token: 'token-2',
            provider: 'google',
            expiresAt: futureDate,
            userAgent: 'Chrome',
            ipAddress: '192.168.1.2',
            lastActivityAt: new Date(),
            createdAt: new Date(),
            revokedAt: null,
          },
          user: {
            id: userId,
            roles: ['contributor'],
          },
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockSessions),
            }),
          }),
        }),
      });

      const sessions = await getUserSessions(userId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
      expect(sessions[1].id).toBe('session-2');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions and return count', async () => {
      const mockExpiredSessions = [
        { id: 'session-1' },
        { id: 'session-2' },
        { id: 'session-3' },
      ];

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockExpiredSessions),
        }),
      });

      const count = await cleanupExpiredSessions();

      expect(count).toBe(3);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('Session TTL and sliding expiry', () => {
    it('should extend session expiry on validation (sliding window)', async () => {
      const token = 'valid-token';
      const now = Date.now();
      const originalExpiry = new Date(now + 12 * 60 * 60 * 1000); // 12 hours from now

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token,
        provider: 'github',
        expiresAt: originalExpiry,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        lastActivityAt: new Date(now - 60 * 1000), // 1 minute ago
        createdAt: new Date(now - 12 * 60 * 60 * 1000), // 12 hours ago
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      const updateMock = vi.fn().mockResolvedValue({});
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateMock,
        }),
      });

      await validateSession(token);

      // Verify that update was called to extend expiry (sliding window)
      expect(db.update).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });
  });
});
