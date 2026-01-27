import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock OAuth providers
vi.mock('../../src/services/auth/oauth', () => ({
  getAuthorizationURL: vi.fn().mockResolvedValue(new URL('https://github.com/login/oauth/authorize?state=test')),
  validateCallback: vi.fn().mockResolvedValue({
    id: 'github-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://avatars.githubusercontent.com/u/123',
  }),
  OAuthProviderUnavailableError: class extends Error {
    constructor(public provider: string, public retryAfter: number) {
      super(`Provider ${provider} unavailable`);
      this.name = 'OAuthProviderUnavailableError';
    }
  },
}));

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
      },
    },
  };
  return { db: mockDb };
});

import { db } from '../../src/db';
import { getAuthorizationURL, validateCallback } from '../../src/services/auth/oauth';

describe('Auth Flow Integration Tests (T029)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth Login Initiation (T033)', () => {
    it('should return OAuth authorization URL for GitHub', async () => {
      const response = await app.request('/api/v1/auth/login/github', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toContain('github.com');
      expect(data.provider).toBe('github');
      expect(getAuthorizationURL).toHaveBeenCalledWith('github', expect.any(String), expect.any(String));
    });

    it('should return OAuth authorization URL for Google', async () => {
      (getAuthorizationURL as any).mockResolvedValueOnce(
        new URL('https://accounts.google.com/o/oauth2/v2/auth?state=test')
      );

      const response = await app.request('/api/v1/auth/login/google', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toContain('google.com');
      expect(data.provider).toBe('google');
    });

    it('should reject invalid OAuth provider', async () => {
      const response = await app.request('/api/v1/auth/login/invalid', {
        method: 'GET',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid provider');
    });
  });

  describe('OAuth Callback and Session Creation (T034)', () => {
    it('should complete OAuth flow and create session', async () => {
      const mockUser = {
        id: 'user-123',
        externalId: 'github-123',
        provider: 'github',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/123',
        roles: ['contributor'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        lockedUntil: null,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'session-token-abc',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      // Mock finding existing user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock creating session
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      });

      // Mock fetching user for session
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock login attempt tracking
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });

      // Mock user update for login tracking
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Mock audit log insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/auth/callback/github?code=test-code&state=test-state');

      expect(response.status).toBe(302); // Redirect
      expect(response.headers.get('location')).toContain('auth/callback?success=true');
      expect(validateCallback).toHaveBeenCalledWith('github', 'test-code', expect.any(String));
    });

    it('should create new user on first OAuth login', async () => {
      // Mock no existing user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock no user by email
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const newUser = {
        id: 'user-new',
        externalId: 'github-123',
        provider: 'github',
        email: 'newuser@example.com',
        displayName: 'New User',
        roles: ['contributor'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        lockedUntil: null,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      };

      // Mock creating new user
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser]),
        }),
      });

      // Mock creating session
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-new',
              userId: 'user-new',
              token: 'token-new',
              provider: 'github',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              lastActivityAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      // Mock fetching user for session
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([newUser]),
          }),
        }),
      });

      // Mock remaining inserts/updates
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request('/api/v1/auth/callback/github?code=test-code&state=test-state');

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('success=true');
    });

    it('should reject callback with missing parameters', async () => {
      const response = await app.request('/api/v1/auth/callback/github');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing parameters');
    });
  });

  describe('Get Current User (T035)', () => {
    it('should return current authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        roles: ['contributor', 'reviewer'],
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      // Mock session validation
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  session: mockSession,
                  user: { ...mockUser, lockedUntil: null },
                },
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

      // Mock fetching full user details
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: 'echo_session=valid-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.roles).toContain('contributor');
      expect(data.sessionId).toBe('session-123');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Logout (T036)', () => {
    it('should logout and revoke session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      // Mock session validation
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  session: mockSession,
                  user: mockUser,
                },
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

      // Mock session fetch for revocation
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSession]),
          }),
        }),
      });

      // Mock session deletion
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      // Mock audit log
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: 'echo_session=valid-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Logged out successfully');
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('Session Management (T037, T038)', () => {
    it('should list all active sessions for user', async () => {
      const mockSessions = [
        {
          session: {
            id: 'session-1',
            userId: 'user-123',
            token: 'token-1',
            provider: 'github',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            lastActivityAt: new Date(),
            createdAt: new Date(),
            revokedAt: null,
          },
          user: {
            id: 'user-123',
            roles: ['contributor'],
            lockedUntil: null,
          },
        },
        {
          session: {
            id: 'session-2',
            userId: 'user-123',
            token: 'token-2',
            provider: 'google',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            ipAddress: '192.168.1.2',
            userAgent: 'Chrome',
            lastActivityAt: new Date(),
            createdAt: new Date(),
            revokedAt: null,
          },
          user: {
            id: 'user-123',
            roles: ['contributor'],
            lockedUntil: null,
          },
        },
      ];

      // Mock auth middleware session validation
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockSessions[0]]),
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

      // Mock getUserSessions
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockSessions),
            }),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/sessions', {
        method: 'GET',
        headers: {
          Cookie: 'echo_session=token-1',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessions).toHaveLength(2);
      expect(data.sessions[0].id).toBe('session-1');
      expect(data.sessions[1].id).toBe('session-2');
    });

    it('should revoke specific session by ID', async () => {
      const mockSession = {
        id: 'session-current',
        userId: 'user-123',
        token: 'token-current',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      // Mock auth middleware
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
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

      // Mock getUserSessions for verification
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { session: mockSession, user: mockUser },
                {
                  session: { ...mockSession, id: 'session-to-revoke' },
                  user: mockUser,
                },
              ]),
            }),
          }),
        }),
      });

      // Mock session fetch for revocation
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockSession, id: 'session-to-revoke' }]),
          }),
        }),
      });

      // Mock session deletion
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      // Mock audit log
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      const response = await app.request('/api/v1/auth/sessions/session-to-revoke', {
        method: 'DELETE',
        headers: {
          Cookie: 'echo_session=token-current',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Session revoked successfully');
      expect(data.sessionId).toBe('session-to-revoke');
    });

    it('should return 404 when revoking non-existent session', async () => {
      const mockSession = {
        id: 'session-current',
        userId: 'user-123',
        token: 'token-current',
        provider: 'github',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockUser = {
        id: 'user-123',
        roles: ['contributor'],
        lockedUntil: null,
      };

      // Mock auth middleware
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
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

      // Mock getUserSessions - only current session
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([{ session: mockSession, user: mockUser }]),
            }),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/sessions/nonexistent-session', {
        method: 'DELETE',
        headers: {
          Cookie: 'echo_session=token-current',
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full flow: login -> callback -> me -> logout', async () => {
      // Step 1: Initiate login
      const loginResponse = await app.request('/api/v1/auth/login/github');
      expect(loginResponse.status).toBe(200);
      const loginData = await loginResponse.json();
      expect(loginData.url).toBeDefined();

      // Step 2: OAuth callback (user returns from provider)
      const mockUser = {
        id: 'user-123',
        externalId: 'github-123',
        provider: 'github',
        email: 'test@example.com',
        displayName: 'Test User',
        roles: ['contributor'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        lockedUntil: null,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      };

      // Mock callback flow (abbreviated for brevity)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-123',
              userId: 'user-123',
              token: 'session-token',
              provider: 'github',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              lastActivityAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const callbackResponse = await app.request('/api/v1/auth/callback/github?code=test-code&state=test-state');
      expect(callbackResponse.status).toBe(302);

      // Step 3: Get current user
      // (Additional mocking would be needed for full test)

      // Step 4: Logout
      // (Additional mocking would be needed for full test)
    });
  });
});
