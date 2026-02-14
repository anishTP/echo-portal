import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  generateToken,
  validateToken,
  isTokenExpired,
  markTokenUsed,
  invalidateUserTokens,
  cleanupExpiredTokens,
} from '../../src/services/auth/token.js';

// Mock the database
vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the schema
vi.mock('../../src/db/schema/index.js', () => ({
  authTokens: {
    id: 'id',
    userId: 'userId',
    token: 'token',
    type: 'type',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
    createdAt: 'createdAt',
  },
}));

import { db } from '../../src/db/index.js';

describe('Token Service - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateToken', () => {
    it('should store a token in the DB and return the token string', async () => {
      const userId = 'user-abc-123';

      const mockReturning = vi.fn().mockResolvedValue([{ id: 'token-id-1', token: 'generated-token' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const token = await generateToken(userId, 'verification');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'verification',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should set 24h expiry for verification tokens', async () => {
      const userId = 'user-abc-123';

      const mockReturning = vi.fn().mockResolvedValue([{ id: 'token-id-1', token: 'generated-token' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      await generateToken(userId, 'verification');

      const valuesArg = mockValues.mock.calls[0][0];
      const expectedExpiry = new Date('2026-02-15T12:00:00.000Z'); // 24h later
      expect(valuesArg.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should set 1h expiry for password_reset tokens', async () => {
      const userId = 'user-abc-123';

      const mockReturning = vi.fn().mockResolvedValue([{ id: 'token-id-1', token: 'generated-token' }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      await generateToken(userId, 'password_reset');

      const valuesArg = mockValues.mock.calls[0][0];
      const expectedExpiry = new Date('2026-02-14T13:00:00.000Z'); // 1h later
      expect(valuesArg.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should return a base64url-encoded token string', async () => {
      const userId = 'user-abc-123';

      let capturedToken = '';
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockImplementation((vals: any) => {
        capturedToken = vals.token;
        return { returning: mockReturning };
      });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const result = await generateToken(userId, 'verification');

      // The returned value should match what was stored
      expect(result).toBe(capturedToken);
      // base64url characters only
      expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('validateToken', () => {
    it('should return the record for a valid, non-expired token', async () => {
      const futureExpiry = new Date('2026-02-15T12:00:00.000Z'); // 24h in the future

      const mockRecord = {
        id: 'token-id-1',
        userId: 'user-abc-123',
        token: 'valid-token',
        type: 'verification',
        expiresAt: futureExpiry,
        usedAt: null,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await validateToken('valid-token', 'verification');

      expect(result).toEqual({ id: 'token-id-1', userId: 'user-abc-123' });
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when no matching token is found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await validateToken('nonexistent-token', 'verification');

      expect(result).toBeNull();
    });

    it('should return null when the token is expired', async () => {
      const pastExpiry = new Date('2026-02-14T11:00:00.000Z'); // 1h in the past

      const mockRecord = {
        id: 'token-id-expired',
        userId: 'user-abc-123',
        token: 'expired-token',
        type: 'verification',
        expiresAt: pastExpiry,
        usedAt: null,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await validateToken('expired-token', 'verification');

      expect(result).toBeNull();
    });

    it('should return null when the token type does not match', async () => {
      // The DB query filters by type, so a mismatched type returns no records
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await validateToken('some-token', 'password_reset');

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for an existing but expired token', async () => {
      const pastExpiry = new Date('2026-02-14T10:00:00.000Z'); // 2h in the past

      const mockRecord = {
        id: 'token-id-expired',
        userId: 'user-abc-123',
        token: 'expired-token',
        type: 'verification',
        expiresAt: pastExpiry,
        usedAt: null,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await isTokenExpired('expired-token', 'verification');

      expect(result).toBe(true);
    });

    it('should return false when the token does not exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await isTokenExpired('nonexistent-token', 'verification');

      expect(result).toBe(false);
    });

    it('should return false for a valid, non-expired token', async () => {
      const futureExpiry = new Date('2026-02-15T12:00:00.000Z'); // 24h in the future

      const mockRecord = {
        id: 'token-id-valid',
        userId: 'user-abc-123',
        token: 'valid-token',
        type: 'verification',
        expiresAt: futureExpiry,
        usedAt: null,
        createdAt: new Date(),
      };

      const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await isTokenExpired('valid-token', 'verification');

      expect(result).toBe(false);
    });
  });

  describe('markTokenUsed', () => {
    it('should update the token with a usedAt timestamp', async () => {
      const tokenId = 'token-id-1';

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      await markTokenUsed(tokenId);

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          usedAt: expect.any(Date),
        })
      );
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should set usedAt to the current time', async () => {
      const tokenId = 'token-id-1';

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      await markTokenUsed(tokenId);

      const setArg = mockSet.mock.calls[0][0];
      expect(setArg.usedAt.getTime()).toBe(new Date('2026-02-14T12:00:00.000Z').getTime());
    });
  });

  describe('invalidateUserTokens', () => {
    it('should mark all unused tokens of the given type as used for the user', async () => {
      const userId = 'user-abc-123';

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      await invalidateUserTokens(userId, 'verification');

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          usedAt: expect.any(Date),
        })
      );
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should work with password_reset token type', async () => {
      const userId = 'user-abc-123';

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      await invalidateUserTokens(userId, 'password_reset');

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          usedAt: expect.any(Date),
        })
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return the count', async () => {
      const mockExpiredTokens = [
        { id: 'token-1' },
        { id: 'token-2' },
        { id: 'token-3' },
      ];

      const mockReturning = vi.fn().mockResolvedValue(mockExpiredTokens);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const count = await cleanupExpiredTokens();

      expect(count).toBe(3);
      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should return 0 when no expired tokens exist', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const count = await cleanupExpiredTokens();

      expect(count).toBe(0);
    });

    it('should return correct count for single expired token', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'token-1' }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const count = await cleanupExpiredTokens();

      expect(count).toBe(1);
    });
  });
});
