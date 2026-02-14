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
  validateToken: vi.fn().mockResolvedValue({ id: 'token-id', userId: 'user-id' }),
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
  validateCallback: vi.fn(),
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../../src/db';
import { validateToken, isTokenExpired, markTokenUsed } from '../../src/services/auth/token';
import { logAudit } from '../../src/services/audit/logger';

describe('Auth Verify Email Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  it('should verify email successfully with valid token (200)', async () => {
    (isTokenExpired as any).mockResolvedValueOnce(false);
    (validateToken as any).mockResolvedValueOnce({ id: 'token-id', userId: 'user-id' });

    // Mock db.update for marking emailVerified=true
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });

    const response = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-verification-token' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('Email verified successfully');
    expect(markTokenUsed).toHaveBeenCalledWith('token-id');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auth.verify_email',
      actorId: 'user-id',
    }));
  });

  it('should return 410 for expired verification token', async () => {
    (isTokenExpired as any).mockResolvedValueOnce(true);

    const response = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'expired-token' }),
    });

    expect(response.status).toBe(410);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('expired');
  });

  it('should return 400 for invalid or already-used token', async () => {
    (isTokenExpired as any).mockResolvedValueOnce(false);
    (validateToken as any).mockResolvedValueOnce(null);

    const response = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invalid or already-used');
  });

  it('should return 400 when token is missing', async () => {
    const response = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  describe('Resend Verification', () => {
    it('should resend verification email for unverified user (200)', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'unverified@example.com',
        provider: 'email',
        emailVerified: false,
      };

      // db.select for finding unverified user
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unverified@example.com' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('verification email has been sent');
    });

    it('should return 200 even when email does not exist (no enumeration)', async () => {
      // db.select returns empty — user not found
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
