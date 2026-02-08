import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService, AIServiceError } from '../../src/services/ai/ai-service';

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    $count: vi.fn(),
    query: {},
  },
}));

// Mock schema modules
vi.mock('../../src/db/schema/ai-requests', () => ({
  aiRequests: {
    id: 'id',
    conversationId: 'conversationId',
    userId: 'userId',
    branchId: 'branchId',
    contentId: 'contentId',
    requestType: 'requestType',
    prompt: 'prompt',
    selectedText: 'selectedText',
    status: 'status',
    providerId: 'providerId',
    modelId: 'modelId',
    tokensUsed: 'tokensUsed',
    generatedContent: 'generatedContent',
    errorMessage: 'errorMessage',
    resolvedAt: 'resolvedAt',
    resolvedBy: 'resolvedBy',
    createdAt: 'createdAt',
    expiresAt: 'expiresAt',
  },
}));

vi.mock('../../src/db/schema/ai-conversations', () => ({
  aiConversations: {
    id: 'id',
    userId: 'userId',
    branchId: 'branchId',
    sessionId: 'sessionId',
    status: 'status',
    turnCount: 'turnCount',
    maxTurns: 'maxTurns',
    updatedAt: 'updatedAt',
    expiresAt: 'expiresAt',
    endReason: 'endReason',
    createdAt: 'createdAt',
  },
}));

vi.mock('../../src/db/schema/ai-configurations', () => ({
  aiConfigurations: {
    id: 'id',
    scope: 'scope',
    key: 'key',
    value: 'value',
    updatedBy: 'updatedBy',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  },
}));

// Mock provider registry
vi.mock('../../src/services/ai/provider-registry', () => ({
  providerRegistry: {
    getDefault: vi.fn(),
  },
}));

// Mock conversation service
vi.mock('../../src/services/ai/conversation-service', () => ({
  conversationService: {
    create: vi.fn(),
    getById: vi.fn(),
    addTurn: vi.fn(),
  },
}));

// Mock rate limiter
vi.mock('../../src/services/ai/rate-limiter', () => ({
  aiRateLimiter: {
    checkLimit: vi.fn(),
  },
}));

// Mock config service
vi.mock('../../src/services/ai/ai-config-service', () => ({
  aiConfigService: {
    isEnabled: vi.fn().mockResolvedValue(true),
    getEffectiveLimits: vi.fn().mockResolvedValue({
      maxTokens: 4000,
      rateLimit: 50,
      maxTurns: 20,
    }),
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { db } from '../../src/db';
import { providerRegistry } from '../../src/services/ai/provider-registry';
import { conversationService } from '../../src/services/ai/conversation-service';
import { aiRateLimiter } from '../../src/services/ai/rate-limiter';
import { aiConfigService } from '../../src/services/ai/ai-config-service';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIService();
  });

  describe('AIServiceError', () => {
    it('creates error with code, message, and status', () => {
      const error = new AIServiceError('TEST_CODE', 'Test message', 409);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.status).toBe(409);
      expect(error.name).toBe('AIServiceError');
    });

    it('defaults status to 400', () => {
      const error = new AIServiceError('TEST', 'Test');
      expect(error.status).toBe(400);
    });
  });

  describe('acceptRequest()', () => {
    it('accepts a pending request and returns updated record', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: 'user-1',
        status: 'pending',
        conversationId: 'conv-1',
        providerId: 'echo',
        modelId: 'echo-v1',
        generatedContent: 'AI content',
      };
      const mockUpdated = { ...mockRequest, status: 'accepted', resolvedAt: new Date(), resolvedBy: 'user' };

      // Mock getRequestForUser
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      // Mock update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      const result = await service.acceptRequest('req-1', 'user-1', {
        contentId: 'content-1',
      });

      expect(result.status).toBe('accepted');
    });

    it('throws INVALID_STATE if request is not pending', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'accepted' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      await expect(
        service.acceptRequest('req-1', 'user-1', { contentId: 'content-1' })
      ).rejects.toThrow(AIServiceError);
    });
  });

  describe('rejectRequest()', () => {
    it('rejects a pending request', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'pending', conversationId: 'conv-1' };
      const mockUpdated = { ...mockRequest, status: 'rejected', resolvedAt: new Date(), resolvedBy: 'user' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      const result = await service.rejectRequest('req-1', 'user-1', 'Not helpful');
      expect(result.status).toBe('rejected');
    });

    it('throws INVALID_STATE if request is not pending', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'generating' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      await expect(
        service.rejectRequest('req-1', 'user-1')
      ).rejects.toThrow(AIServiceError);
    });
  });

  describe('cancelRequest()', () => {
    it('cancels a generating request', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'generating', conversationId: 'conv-1' };
      const mockUpdated = { ...mockRequest, status: 'cancelled', resolvedBy: 'user' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      const result = await service.cancelRequest('req-1', 'user-1');
      expect(result.status).toBe('cancelled');
    });

    it('throws INVALID_STATE if request is not generating', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'pending' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      await expect(
        service.cancelRequest('req-1', 'user-1')
      ).rejects.toThrow(AIServiceError);
    });
  });

  describe('getRequestForUser()', () => {
    it('returns request if owned by user', async () => {
      const mockRequest = { id: 'req-1', userId: 'user-1', status: 'pending' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      const result = await service.getRequestForUser('req-1', 'user-1');
      expect(result).toEqual(mockRequest);
    });

    it('throws NOT_FOUND if request does not exist', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.getRequestForUser('missing-id', 'user-1')
      ).rejects.toThrow(AIServiceError);
    });

    it('throws FORBIDDEN if request belongs to another user', async () => {
      const mockRequest = { id: 'req-1', userId: 'other-user' };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      });

      await expect(
        service.getRequestForUser('req-1', 'user-1')
      ).rejects.toThrow(AIServiceError);
    });
  });

  describe('generate()', () => {
    it('throws AI_DISABLED when AI is disabled', async () => {
      (aiConfigService.isEnabled as any).mockResolvedValueOnce(false);

      await expect(
        service.generate({
          userId: 'user-1',
          branchId: 'branch-1',
          prompt: 'Hello',
          sessionId: 'sess-1',
          sessionExpiresAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow('AI assistance is currently disabled');
    });

    it('throws RATE_LIMIT_EXCEEDED when rate limited', async () => {
      (aiRateLimiter.checkLimit as any).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      await expect(
        service.generate({
          userId: 'user-1',
          branchId: 'branch-1',
          prompt: 'Hello',
          sessionId: 'sess-1',
          sessionExpiresAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow('AI request limit exceeded');
    });
  });
});
