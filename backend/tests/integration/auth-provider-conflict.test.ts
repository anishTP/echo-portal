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
      users: { findFirst: vi.fn() },
    },
  };
  return { db: mockDb };
});

// Mock session
vi.mock('../../src/services/auth/session', () => ({
  createSession: vi.fn().mockResolvedValue({
    id: 'session-id',
    userId: 'user-id',
    token: 'session-token',
    provider: 'email',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    role: 'contributor',
  }),
  validateSession: vi.fn().mockResolvedValue(null),
  revokeSession: vi.fn().mockResolvedValue(undefined),
  revokeSessionByToken: vi.fn().mockResolvedValue(undefined),
  revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
  getUserSessions: vi.fn().mockResolvedValue([]),
  invalidateUserSessionCache: vi.fn(),
  cleanupExpiredSessions: vi.fn(),
}));

// Mock password service
vi.mock('../../src/services/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$hashed'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  validatePasswordStrength: vi.fn().mockReturnValue({
    valid: true,
    criteria: { minLength: true, hasUppercase: true, hasLowercase: true, hasNumber: true, hasSpecial: false, typesCount: 3 },
  }),
}));

// Mock token service
vi.mock('../../src/services/auth/token', () => ({
  generateToken: vi.fn().mockResolvedValue('test-token'),
  validateToken: vi.fn().mockResolvedValue(null),
  isTokenExpired: vi.fn().mockResolvedValue(false),
  markTokenUsed: vi.fn().mockResolvedValue(undefined),
  invalidateUserTokens: vi.fn().mockResolvedValue(undefined),
  cleanupExpiredTokens: vi.fn().mockResolvedValue(0),
}));

// Mock email service
vi.mock('../../src/services/email/index', () => ({
  getEmailService: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue(undefined),
  }),
  createEmailService: vi.fn(),
}));

vi.mock('../../src/services/email/templates', () => ({
  verificationEmail: vi.fn().mockReturnValue({ subject: 'Verify', text: 'verify text', html: '<p>verify</p>' }),
  passwordResetEmail: vi.fn().mockReturnValue({ subject: 'Reset', text: 'reset text', html: '<p>reset</p>' }),
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock OAuth
vi.mock('../../src/services/auth/oauth', () => ({
  getAuthorizationURL: vi.fn(),
  validateCallback: vi.fn().mockResolvedValue({
    id: 'github-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://avatars.example.com/123',
  }),
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../../src/db';
import { getAuthorizationURL } from '../../src/services/auth/oauth';

describe('Auth Provider Conflict Integration Tests (FR-024)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  describe('Email signup with existing OAuth user', () => {
    it('should return 409 when email is already used by an OAuth user', async () => {
      const existingOAuthUser = {
        id: 'oauth-user-id',
        email: 'test@example.com',
        provider: 'github',
        externalId: 'github-123',
      };

      // db.select for checking existing user (by email)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingOAuthUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test1234!',
          displayName: 'Test User',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('already exists');
    });
  });

  describe('OAuth login with existing email user', () => {
    it('should redirect with provider_conflict error when OAuth email matches email user', async () => {
      // First, initiate OAuth login to get a valid state
      let capturedState = '';
      (getAuthorizationURL as any).mockImplementation((_provider: string, state: string, _codeVerifier: string) => {
        capturedState = state;
        return Promise.resolve(new URL(`https://github.com/login/oauth/authorize?state=${state}`));
      });

      await app.request('/api/v1/auth/login/github');

      // Mock: checkAccountLockout — user by email (found, not locked)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'email-user-id',
              email: 'test@example.com',
              provider: 'email',
              lockedUntil: null,
            }]),
          }),
        }),
      });

      // Mock: checkAccountLockout — recent failures
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock: findOrCreateUser — lookup by externalId + provider (not found)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock: findOrCreateUser — lookup by email (found with different provider!)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'email-user-id',
              email: 'test@example.com',
              provider: 'email',
            }]),
          }),
        }),
      });

      // Fallback mocks for recordLoginAttempt (insert attempt, check failures, update user)
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'attempt-id' }]),
        }),
      });
      // recordLoginAttempt: check recent failures (db.select from loginAttempts, no .limit())
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request(
        `/api/v1/auth/callback/github?code=test-code&state=${capturedState}`
      );

      expect(response.status).toBe(302);
      const location = response.headers.get('location') || '';
      expect(location).toContain('error=provider_conflict');
      expect(location).toContain('existing_provider=email');
    });
  });

  describe('Email signup when email user already exists', () => {
    it('should return 409 when email is already used by another email user', async () => {
      const existingEmailUser = {
        id: 'existing-email-user-id',
        email: 'test@example.com',
        provider: 'email',
      };

      // db.select for checking existing user (by email)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingEmailUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test1234!',
          displayName: 'Another User',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error.message).toContain('already exists');
    });
  });
});
