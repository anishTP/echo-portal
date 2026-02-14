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

// Mock session for auth middleware
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
import { verifyPassword } from '../../src/services/auth/password';
import { createSession } from '../../src/services/auth/session';

describe('Auth Login Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  // Helper to set up DB mocks for the email-login endpoint
  // The endpoint does:
  // 1. checkAccountLockout: db.select from users (by email)
  // 2. checkAccountLockout: db.select from loginAttempts (recent failures)
  // 3. db.select from users (by email + provider='email')
  function setupLoginMocks(options: {
    lockoutUser?: any;
    recentFailures?: any[];
    emailUser?: any;
  }) {
    const { lockoutUser = null, recentFailures = [], emailUser = null } = options;

    // 1. checkAccountLockout: lookup user by email
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(lockoutUser ? [lockoutUser] : []),
        }),
      }),
    });

    // 2. checkAccountLockout: recent failed login attempts (no .limit())
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(recentFailures),
      }),
    });

    // 3. Find user by email + provider='email'
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(emailUser ? [emailUser] : []),
        }),
      }),
    });

    // Fallback mocks for recordLoginAttempt insert + update
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'attempt-id' }]),
      }),
    });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });
  }

  it('should login successfully with valid credentials (200)', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      provider: 'email',
      passwordHash: '$argon2id$existing-hash',
      emailVerified: true,
      isActive: true,
      roles: ['contributor'],
      lockedUntil: null,
      failedLoginCount: 0,
    };

    setupLoginMocks({ emailUser: mockUser });
    (verifyPassword as any).mockResolvedValueOnce(true);

    // Additional select mock for createSession user lookup
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'Test1234!' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe('test@example.com');
    expect(data.data.user.roles).toContain('contributor');
    expect(createSession).toHaveBeenCalledWith('user-id', 'email', undefined, undefined);
  });

  it('should return 401 for invalid credentials', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      provider: 'email',
      passwordHash: '$argon2id$existing-hash',
      emailVerified: true,
      isActive: true,
      roles: ['contributor'],
      lockedUntil: null,
      failedLoginCount: 0,
    };

    setupLoginMocks({ emailUser: mockUser });
    (verifyPassword as any).mockResolvedValueOnce(false);

    // Additional mock for recordLoginAttempt's failed count check
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'WrongPassword1!' }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('Invalid email or password');
  });

  it('should return 401 when user does not exist (no account enumeration)', async () => {
    setupLoginMocks({ emailUser: null });

    // Additional mock for recordLoginAttempt's failed count check
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'Test1234!' }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.message).toBe('Invalid email or password');
  });

  it('should return 403 for unverified email', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'unverified@example.com',
      provider: 'email',
      passwordHash: '$argon2id$existing-hash',
      emailVerified: false,
      isActive: true,
      roles: ['contributor'],
      lockedUntil: null,
      failedLoginCount: 0,
    };

    setupLoginMocks({ emailUser: mockUser });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unverified@example.com', password: 'Test1234!' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.message).toContain('verify your email');
    expect(data.error.needsVerification).toBe(true);
  });

  it('should return 423 when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    const lockedUser = {
      id: 'user-id',
      email: 'locked@example.com',
      provider: 'email',
      lockedUntil,
      failedLoginCount: 5,
    };

    // 1. checkAccountLockout: returns locked user
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([lockedUser]),
        }),
      }),
    });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'locked@example.com', password: 'Test1234!' }),
    });

    expect(response.status).toBe(423);
    const data = await response.json();
    expect(data.error.message).toContain('temporarily locked');
    expect(data.error.lockedUntil).toBeDefined();
  });

  it('should return 403 for deactivated account', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'deactivated@example.com',
      provider: 'email',
      passwordHash: '$argon2id$existing-hash',
      emailVerified: true,
      isActive: false,
      roles: ['contributor'],
      lockedUntil: null,
      failedLoginCount: 0,
    };

    setupLoginMocks({ emailUser: mockUser });

    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'deactivated@example.com', password: 'Test1234!' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.message).toContain('deactivated');
  });

  it('should return 400 for invalid email format', async () => {
    const response = await app.request('/api/v1/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'Test1234!' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
