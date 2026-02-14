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
import { verifyPassword, hashPassword, validatePasswordStrength } from '../../src/services/auth/password';
import { validateSession, revokeSession, getUserSessions } from '../../src/services/auth/session';
import { logAudit } from '../../src/services/audit/logger';

describe('Auth Change Password Integration Tests', () => {
  const mockEmailUser = {
    id: 'user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    provider: 'email',
    passwordHash: '$argon2id$existing-hash',
    emailVerified: true,
    isActive: true,
    roles: ['contributor'],
    lockedUntil: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  // Helper to set up authenticated session mocks
  // authMiddleware: validateSession() -> db.select(user) -> set context
  function setupAuthenticatedSession(user: any = mockEmailUser) {
    // 1. validateSession returns valid session
    (validateSession as any).mockResolvedValueOnce({
      id: 'current-session-id',
      userId: user.id,
      role: 'contributor',
    });

    // 2. authMiddleware: fetch user after validateSession
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([user]),
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

  it('should change password successfully for email user (200)', async () => {
    setupAuthenticatedSession();

    // change-password handler: fetch user by id
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockEmailUser]),
        }),
      }),
    });

    (verifyPassword as any).mockResolvedValueOnce(true);
    (getUserSessions as any).mockResolvedValueOnce([
      { id: 'current-session-id' },
      { id: 'other-session-id' },
    ]);

    const response = await app.request('/api/v1/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-session-token',
      },
      body: JSON.stringify({
        currentPassword: 'OldPass1234!',
        newPassword: 'NewPass1234!',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('Password changed successfully');
    expect(hashPassword).toHaveBeenCalledWith('NewPass1234!');
    // Should revoke OTHER sessions but not current
    expect(revokeSession).toHaveBeenCalledWith('other-session-id');
    expect(revokeSession).not.toHaveBeenCalledWith('current-session-id');
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auth.password_changed',
    }));
  });

  it('should return 403 for OAuth user attempting to change password', async () => {
    const oauthUser = { ...mockEmailUser, provider: 'github', passwordHash: null };
    setupAuthenticatedSession(oauthUser);

    // change-password handler: fetch user by id
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([oauthUser]),
        }),
      }),
    });

    const response = await app.request('/api/v1/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-session-token',
      },
      body: JSON.stringify({
        currentPassword: 'OldPass1234!',
        newPassword: 'NewPass1234!',
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.message).toContain('email accounts');
  });

  it('should return 403 when current password is incorrect', async () => {
    setupAuthenticatedSession();

    // change-password handler: fetch user by id
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockEmailUser]),
        }),
      }),
    });

    (verifyPassword as any).mockResolvedValueOnce(false);

    const response = await app.request('/api/v1/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-session-token',
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword1!',
        newPassword: 'NewPass1234!',
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.message).toContain('Current password is incorrect');
  });

  it('should return 400 when new password is too weak', async () => {
    setupAuthenticatedSession();

    // change-password handler: fetch user by id
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockEmailUser]),
        }),
      }),
    });

    (verifyPassword as any).mockResolvedValueOnce(true);
    (validatePasswordStrength as any).mockReturnValueOnce({
      valid: false,
      criteria: { minLength: true, hasUppercase: false, hasLowercase: true, hasNumber: false, hasSpecial: false, typesCount: 1 },
    });

    const response = await app.request('/api/v1/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'echo_session=valid-session-token',
      },
      body: JSON.stringify({
        currentPassword: 'OldPass1234!',
        newPassword: 'weakpassword',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain('strength requirements');
  });

  it('should return 401 when not authenticated', async () => {
    const response = await app.request('/api/v1/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'OldPass1234!',
        newPassword: 'NewPass1234!',
      }),
    });

    expect(response.status).toBe(401);
  });
});
