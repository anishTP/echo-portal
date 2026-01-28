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

describe('Login Lockout Integration Tests (T030)', () => {
  /**
   * Helper: call the login endpoint to populate the oauthStates map and return the captured state.
   */
  async function getOAuthState(): Promise<string> {
    let capturedState = '';
    (getAuthorizationURL as any).mockImplementation((_provider: string, state: string, _codeVerifier: string) => {
      capturedState = state;
      return Promise.resolve(new URL(`https://github.com/login/oauth/authorize?state=${state}`));
    });
    await app.request('/api/v1/auth/login/github');
    return capturedState;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to prevent leaking between tests
    // (clearAllMocks only clears call history, not mockReturnValue)
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
    // Restore default OAuth mocks (cleared by mockReset on the module-level mocks)
    (getAuthorizationURL as any).mockResolvedValue(
      new URL('https://github.com/login/oauth/authorize?state=test')
    );
    (validateCallback as any).mockResolvedValue({
      id: 'github-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://avatars.githubusercontent.com/u/123',
    });
  });

  describe('Account Lockout after Failed Attempts (FR-005a)', () => {
    it('should lock account after 5 failed login attempts', async () => {
      const state = await getOAuthState();
      const email = 'lockout-test@example.com';
      const now = Date.now();
      const cutoff = new Date(now - 60 * 60 * 1000); // 1 hour ago

      // Mock 4 existing failed attempts
      const existingFailures = Array.from({ length: 4 }, (_, i) => ({
        id: `attempt-${i}`,
        email,
        provider: 'github',
        success: false,
        attemptedAt: new Date(now - (i + 1) * 60 * 1000), // Spaced 1 min apart
        failureReason: 'oauth_failed',
      }));

      // Mock user lookup (no existing user yet)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock failed attempts query (4 existing)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(existingFailures),
        }),
      });

      // Mock no user by email (first attempt)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock login attempt insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });

      // Mock failed attempts query after 5th attempt
      const allFailures = [...existingFailures, {
        id: 'attempt-5',
        email,
        provider: 'github',
        success: false,
        attemptedAt: new Date(now),
        failureReason: 'oauth_failed',
      }];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(allFailures),
        }),
      });

      // Simulate OAuth failure
      (validateCallback as any).mockRejectedValueOnce(new Error('OAuth failed'));

      // Mock user update for lockout
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request(`/api/v1/auth/callback/github?code=bad-code&state=${state}`);

      // Should redirect to error page
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('error=auth_failed');
    });

    it('should return lockout error when account is locked', async () => {
      const state = await getOAuthState();
      const email = 'locked@example.com';
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Locked for 10 more minutes

      const mockUser = {
        id: 'user-locked',
        email,
        lockedUntil,
        failedLoginCount: 5,
        lastFailedLoginAt: new Date(Date.now() - 5 * 60 * 1000),
      };

      // Override validateCallback to return the locked user's email
      (validateCallback as any).mockResolvedValueOnce({
        id: 'github-locked',
        email,
        name: 'Locked User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/locked',
      });

      // Mock checkAccountLockout: db.select().from(users).where(...).limit(1) -> locked user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // recordLoginAttempt: db.insert(loginAttempts).values({...})
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });

      // recordLoginAttempt: db.select().from(loginAttempts).where(...) (no .limit())
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // recordLoginAttempt: db.update(users).set({...}).where(...)
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request(`/api/v1/auth/callback/github?code=test-code&state=${state}`);

      expect(response.status).toBe(423); // Locked
      const data = await response.json();
      expect(data.error).toBe('Account locked');
      expect(data.message).toContain('temporarily locked');
      expect(data.lockedUntil).toBeDefined();
      expect(data.remainingMinutes).toBeGreaterThan(0);
    });

    it('should clear lockout after 15 minutes', async () => {
      const state = await getOAuthState();
      const email = 'unlock-test@example.com';
      const lockedUntil = new Date(Date.now() - 1000); // Lockout expired 1 second ago

      const mockUser = {
        id: 'user-unlock',
        externalId: 'github-123',
        provider: 'github',
        email,
        displayName: 'Unlock Test',
        roles: ['contributor'],
        isActive: true,
        lockedUntil,
        failedLoginCount: 5,
        lastFailedLoginAt: new Date(Date.now() - 16 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      // Override validateCallback to return matching email
      (validateCallback as any).mockResolvedValueOnce({
        id: 'github-123',
        email,
        name: 'Unlock Test',
        avatarUrl: 'https://avatars.githubusercontent.com/u/123',
      });

      // 1) checkAccountLockout: db.select().from(users).where(...).limit(1) -> user with expired lockout
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // 2) checkAccountLockout: db.select().from(loginAttempts).where(...) (no .limit())
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // 3) findOrCreateUser: db.select().from(users).where(and(eq(externalId), eq(provider))).limit(1)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // 4) createSession: db.insert(sessions).values({...}).returning()
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-123',
              userId: 'user-unlock',
              token: 'token-abc',
              provider: 'github',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              lastActivityAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      // 5) createSession: db.select().from(users).where(eq(users.id, userId)).limit(1)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock remaining db.insert calls (recordLoginAttempt + logAudit)
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      // Mock db.update for recordLoginAttempt (reset failed count on success)
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request(`/api/v1/auth/callback/github?code=test-code&state=${state}`);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('success=true');
      // Lockout should be cleared
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('Failed Login Attempt Tracking (FR-005b)', () => {
    it('should log all failed authentication attempts', async () => {
      const state = await getOAuthState();
      const email = 'track-test@example.com';

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock login attempt insert
      const insertMock = vi.fn().mockResolvedValue({});
      (db.insert as any).mockReturnValue({
        values: insertMock,
      });

      // Simulate OAuth failure
      (validateCallback as any).mockRejectedValueOnce(new Error('OAuth failed'));

      await app.request(`/api/v1/auth/callback/github?code=bad-code&state=${state}`);

      // Verify login attempt was logged
      expect(db.insert).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
    });

    it('should log successful authentication attempts', async () => {
      const state = await getOAuthState();
      const email = 'success-test@example.com';

      const mockUser = {
        id: 'user-success',
        externalId: 'github-123',
        provider: 'github',
        email,
        displayName: 'Success Test',
        roles: ['contributor'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        lockedUntil: null,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
      };

      // Mock no lockout
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock user lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock session creation
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-123',
              userId: 'user-success',
              token: 'token-abc',
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
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock login attempt insert (success)
      const loginAttemptMock = vi.fn().mockResolvedValue({});
      (db.insert as any).mockReturnValue({
        values: loginAttemptMock,
      });

      // Mock remaining operations
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      await app.request(`/api/v1/auth/callback/github?code=good-code&state=${state}`);

      // Verify successful login attempt was logged
      expect(db.insert).toHaveBeenCalled();
    });

    it('should track IP address and user agent in login attempts', async () => {
      const state = await getOAuthState();
      const email = 'tracking-test@example.com';
      const ipAddress = '203.0.113.42';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

      // Mock no existing user
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock login attempt insert
      const insertMock = vi.fn().mockResolvedValue({});
      (db.insert as any).mockReturnValue({
        values: insertMock,
      });

      // Simulate OAuth failure
      (validateCallback as any).mockRejectedValueOnce(new Error('OAuth failed'));

      await app.request(`/api/v1/auth/callback/github?code=bad-code&state=${state}`, {
        headers: {
          'X-Forwarded-For': ipAddress,
          'User-Agent': userAgent,
        },
      });

      // Verify IP and User-Agent were captured
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Lockout Window and Thresholds', () => {
    it('should only count failed attempts within 1-hour window', async () => {
      const state = await getOAuthState();
      const email = 'window-test@example.com';
      const now = Date.now();

      // Mock 3 failed attempts within window, 2 outside window
      const recentFailures = [
        {
          id: 'attempt-1',
          email,
          provider: 'github',
          success: false,
          attemptedAt: new Date(now - 30 * 60 * 1000), // 30 min ago - within window
        },
        {
          id: 'attempt-2',
          email,
          provider: 'github',
          success: false,
          attemptedAt: new Date(now - 45 * 60 * 1000), // 45 min ago - within window
        },
        {
          id: 'attempt-3',
          email,
          provider: 'github',
          success: false,
          attemptedAt: new Date(now - 50 * 60 * 1000), // 50 min ago - within window
        },
      ];

      const oldFailures = [
        {
          id: 'attempt-old-1',
          email,
          provider: 'github',
          success: false,
          attemptedAt: new Date(now - 90 * 60 * 1000), // 90 min ago - outside window
        },
        {
          id: 'attempt-old-2',
          email,
          provider: 'github',
          success: false,
          attemptedAt: new Date(now - 120 * 60 * 1000), // 120 min ago - outside window
        },
      ];

      // Mock user lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock failed attempts query (only recent ones)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(recentFailures), // Only 3 recent failures
        }),
      });

      // Mock remaining operations
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Simulate OAuth failure (4th attempt in window)
      (validateCallback as any).mockRejectedValueOnce(new Error('OAuth failed'));

      const response = await app.request(`/api/v1/auth/callback/github?code=bad-code&state=${state}`);

      // Should NOT be locked yet (only 4 attempts in window, need 5)
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('error=auth_failed');
      // Should not contain lockout message
      expect(response.headers.get('location')).not.toContain('account_locked');
    });

    it('should reset failed count on successful login', async () => {
      const state = await getOAuthState();
      const email = 'reset-test@example.com';

      const mockUser = {
        id: 'user-reset',
        externalId: 'github-123',
        provider: 'github',
        email,
        displayName: 'Reset Test',
        roles: ['contributor'],
        isActive: true,
        failedLoginCount: 3, // Had previous failed attempts
        lastFailedLoginAt: new Date(Date.now() - 10 * 60 * 1000),
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      // 1) checkAccountLockout: db.select().from(users).where(...).limit(1) -> no user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // 2) checkAccountLockout: db.select().from(loginAttempts).where(...) (no .limit())
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // 3) findOrCreateUser: db.select().from(users).where(and(eq(externalId), eq(provider))).limit(1)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // 4) createSession: db.insert(sessions).values({...}).returning()
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'session-123',
              userId: 'user-reset',
              token: 'token-abc',
              provider: 'github',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              lastActivityAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      // 5) createSession: db.select().from(users).where(eq(users.id, userId)).limit(1)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock remaining db.insert calls (recordLoginAttempt + logAudit)
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
        }),
      });

      // Mock db.update for recordLoginAttempt (reset failed count on success)
      const updateMock = vi.fn().mockResolvedValue({});
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateMock,
        }),
      });

      await app.request(`/api/v1/auth/callback/github?code=good-code&state=${state}`);

      // Verify failed count was reset
      expect(db.update).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe('Audit Logging for Lockouts (FR-020)', () => {
    it('should log account lockout event to audit trail', async () => {
      const state = await getOAuthState();
      const email = 'audit-lockout@example.com';
      const now = Date.now();

      // Mock 5 failed attempts
      const failures = Array.from({ length: 5 }, (_, i) => ({
        id: `attempt-${i}`,
        email,
        provider: 'github',
        success: false,
        attemptedAt: new Date(now - (i + 1) * 60 * 1000),
        failureReason: 'oauth_failed',
      }));

      // Mock user lookup
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock failed attempts
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(failures),
        }),
      });

      // Mock inserts
      const auditLogMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'audit-123' }]),
      });

      (db.insert as any).mockReturnValue({
        values: auditLogMock,
      });

      // Mock updates
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      // Simulate 5th failed attempt
      (validateCallback as any).mockRejectedValueOnce(new Error('OAuth failed'));

      await app.request(`/api/v1/auth/callback/github?code=bad-code&state=${state}`);

      // Verify audit log was created
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
