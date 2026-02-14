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
  generateToken: vi.fn().mockResolvedValue('test-verification-token'),
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

// Mock OAuth (auth.ts imports it)
vi.mock('../../src/services/auth/oauth', () => ({
  getAuthorizationURL: vi.fn(),
  validateCallback: vi.fn(),
}));

// Mock notification service (imported by other routes mounted in the app)
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../../src/db';
import { validatePasswordStrength } from '../../src/services/auth/password';
import { generateToken } from '../../src/services/auth/token';
import { getEmailService } from '../../src/services/email/index';

describe('Auth Register Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (db.delete as any).mockReset();
  });

  it('should register a new user successfully (201)', async () => {
    // db.select for checking existing user — not found
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as any).mockReturnValue({ from: mockFrom });

    // db.insert for creating user
    const mockReturning = vi.fn().mockResolvedValue([{
      id: 'new-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      provider: 'email',
      emailVerified: false,
      roles: ['contributor'],
      isActive: true,
    }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    (db.insert as any).mockReturnValue({ values: mockValues });

    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test1234!',
        displayName: 'Test User',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('Account created');
    expect(generateToken).toHaveBeenCalledWith('new-user-id', 'verification');
    expect(getEmailService).toHaveBeenCalled();
  });

  it('should return 409 when email already exists', async () => {
    // db.select for checking existing user — found
    const mockLimit = vi.fn().mockResolvedValue([{
      id: 'existing-user-id',
      email: 'taken@example.com',
      provider: 'email',
    }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as any).mockReturnValue({ from: mockFrom });

    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'taken@example.com',
        password: 'Test1234!',
        displayName: 'Test User',
      }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('already exists');
  });

  it('should return 400 when password is too weak', async () => {
    // Override the password strength validator for this test
    (validatePasswordStrength as any).mockReturnValueOnce({
      valid: false,
      criteria: { minLength: true, hasUppercase: false, hasLowercase: true, hasNumber: false, hasSpecial: false, typesCount: 1 },
    });

    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'weak@example.com',
        password: 'weakpass1',
        displayName: 'Weak Password User',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('strength requirements');
  });

  it('should return 400 for invalid email format', async () => {
    const response = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'Test1234!',
        displayName: 'Bad Email User',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Validation failed');
  });
});
