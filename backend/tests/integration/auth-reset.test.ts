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
  hashPassword: vi.fn().mockResolvedValue('$argon2id$new-hashed'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  validatePasswordStrength: vi.fn().mockReturnValue({
    valid: true,
    criteria: { minLength: true, hasUppercase: true, hasLowercase: true, hasNumber: true, hasSpecial: false, typesCount: 3 },
  }),
}));

// Mock token service
vi.mock('../../src/services/auth/token', () => ({
  generateToken: vi.fn().mockResolvedValue('test-reset-token'),
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
import { validateToken, isTokenExpired, markTokenUsed, invalidateUserTokens, generateToken } from '../../src/services/auth/token';
import { hashPassword, validatePasswordStrength } from '../../src/services/auth/password';
import { revokeAllUserSessions } from '../../src/services/auth/session';
import { getEmailService } from '../../src/services/email/index';
import { logAudit } from '../../src/services/audit/logger';

describe('Auth Reset Password Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 200 and send email for existing email user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        provider: 'email',
      };

      // db.select for finding user by email + provider='email'
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('password reset link has been sent');
      expect(invalidateUserTokens).toHaveBeenCalledWith('user-id', 'password_reset');
      expect(generateToken).toHaveBeenCalledWith('user-id', 'password_reset');
      expect(getEmailService).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'auth.password_reset_requested',
      }));
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

      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      // Should NOT have sent email or created token
      expect(generateToken).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password successfully with valid token (200)', async () => {
      (validateToken as any).mockResolvedValueOnce({ id: 'token-id', userId: 'user-id' });

      // Mock db.update for updating password
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-reset-token', password: 'NewPass1234!' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('Password reset successfully');
      expect(hashPassword).toHaveBeenCalledWith('NewPass1234!');
      expect(markTokenUsed).toHaveBeenCalledWith('token-id');
      expect(revokeAllUserSessions).toHaveBeenCalledWith('user-id');
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'auth.password_reset',
      }));
    });

    it('should return 400 for invalid/used token', async () => {
      (validateToken as any).mockResolvedValueOnce(null);
      (isTokenExpired as any).mockResolvedValueOnce(false);

      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token', password: 'NewPass1234!' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('Invalid or already-used');
    });

    it('should return 400 for expired token with specific message', async () => {
      (validateToken as any).mockResolvedValueOnce(null);
      (isTokenExpired as any).mockResolvedValueOnce(true);

      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'expired-token', password: 'NewPass1234!' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('expired');
    });

    it('should return 400 when new password is too weak', async () => {
      (validatePasswordStrength as any).mockReturnValueOnce({
        valid: false,
        criteria: { minLength: true, hasUppercase: false, hasLowercase: true, hasNumber: false, hasSpecial: false, typesCount: 1 },
      });

      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token', password: 'weakpass' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toContain('strength requirements');
    });
  });
});
