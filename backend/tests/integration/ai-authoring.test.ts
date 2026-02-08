import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
}));

// Mock branch service
vi.mock('../../src/services/branch/branch-service', () => ({
  branchService: {
    getById: vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000010',
      state: 'draft',
      ownerId: '00000000-0000-4000-8000-000000000001',
      collaborators: [],
    }),
  },
}));

// Mock version service
vi.mock('../../src/services/content/version-service', () => ({
  versionService: {
    createVersion: vi.fn().mockResolvedValue({
      id: 'version-1',
      contentId: '00000000-0000-4000-8000-000000000100',
      body: 'AI generated content',
      authorType: 'system',
    }),
  },
}));

// Mock content model
vi.mock('../../src/models/content', () => ({
  createMetadataSnapshot: vi.fn().mockReturnValue({
    title: 'Test Content',
    category: 'general',
    tags: [],
  }),
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock AI service
const mockGenerate = vi.fn();
const mockTransform = vi.fn();
const mockAcceptRequest = vi.fn();
const mockRejectRequest = vi.fn();
const mockCancelRequest = vi.fn();
const mockGetRequestForUser = vi.fn();

vi.mock('../../src/services/ai/ai-service', () => ({
  aiService: {
    generate: (...args: any[]) => mockGenerate(...args),
    transform: (...args: any[]) => mockTransform(...args),
    acceptRequest: (...args: any[]) => mockAcceptRequest(...args),
    rejectRequest: (...args: any[]) => mockRejectRequest(...args),
    cancelRequest: (...args: any[]) => mockCancelRequest(...args),
    getRequestForUser: (...args: any[]) => mockGetRequestForUser(...args),
  },
  AIServiceError: class AIServiceError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
      this.name = 'AIServiceError';
    }
  },
}));

// Mock conversation service
const mockGetActive = vi.fn();
const mockGetById = vi.fn();
const mockEnd = vi.fn();

vi.mock('../../src/services/ai/conversation-service', () => ({
  conversationService: {
    create: vi.fn(),
    getActive: (...args: any[]) => mockGetActive(...args),
    getById: (...args: any[]) => mockGetById(...args),
    addTurn: vi.fn(),
    end: (...args: any[]) => mockEnd(...args),
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
    getFullConfig: vi.fn().mockResolvedValue({
      global: { enabled: true },
      roles: {},
    }),
    update: vi.fn(),
  },
}));

// Mock rate limiter
vi.mock('../../src/services/ai/rate-limiter', () => ({
  aiRateLimiter: {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 49, resetAt: new Date() }),
    getRemainingQuota: vi.fn().mockResolvedValue(49),
  },
}));

// Mock rate limit middleware (pass through)
vi.mock('../../src/api/middleware/ai-rate-limit', () => ({
  aiRateLimitMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => await next()),
}));

// Mock provider registry
vi.mock('../../src/services/ai/provider-registry', () => ({
  providerRegistry: {
    register: vi.fn(),
    getDefault: vi.fn().mockReturnValue({ id: 'echo', displayName: 'Echo' }),
    listProviders: vi.fn().mockReturnValue([{ id: 'echo', displayName: 'Echo' }]),
  },
}));

// Mock echo provider
vi.mock('../../src/services/ai/providers/echo-provider', () => ({
  EchoProvider: vi.fn().mockImplementation(() => ({
    id: 'echo',
    displayName: 'Echo',
  })),
}));

// UUIDs for test data
const UUID_CONTENT = '00000000-0000-4000-8000-000000000100';
const UUID_BRANCH = '00000000-0000-4000-8000-000000000010';
const UUID_USER = '00000000-0000-4000-8000-000000000001';
const testUser = {
  id: UUID_USER,
  externalId: 'github-test',
  provider: 'github',
  email: 'test@example.com',
  displayName: 'Test User',
  roles: ['contributor', 'reviewer'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Track who is authenticated for db lookups
let _currentAuthUser: any = null;

// Mock database — must handle auth middleware's user lookup + other queries
vi.mock('../../src/db', () => {
  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            // Auth middleware user lookup
            if (_currentAuthUser) {
              return Promise.resolve([_currentAuthUser]);
            }
            return Promise.resolve([]);
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'updated-id' }]),
        }),
      }),
    }),
    query: {
      contents: {
        findFirst: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000100',
          title: 'Test Content',
          category: 'general',
          tags: [],
          currentVersionId: 'version-0',
        }),
      },
    },
    $count: vi.fn(),
  };
  return {
    db: mockDb,
    schema: {
      contents: { id: 'id', currentVersionId: 'currentVersionId', updatedAt: 'updatedAt' },
    },
  };
});

import { validateSession } from '../../src/services/auth/session';

function authRequest(method: string, path: string, body?: any) {
  _currentAuthUser = testUser;

  (validateSession as any).mockResolvedValue({
    id: 'session-1',
    userId: UUID_USER,
    token: 'test-token',
    expiresAt: new Date(Date.now() + 86400000),
  });

  const options: RequestInit = {
    method,
    headers: {
      Cookie: 'echo_session=test-token',
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  return app.request(`/api/v1/ai${path}`, options);
}

describe('AI Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _currentAuthUser = null;
  });

  // ==========================================
  // Accept/Reject Flow
  // ==========================================
  describe('POST /requests/:requestId/accept', () => {
    it('returns 200 with version data on successful accept', async () => {
      const mockRequest = {
        id: 'req-1',
        status: 'accepted',
        generatedContent: 'AI text',
        conversationId: 'conv-1',
        providerId: 'echo',
        modelId: 'echo-v1',
      };
      mockAcceptRequest.mockResolvedValue(mockRequest);

      const res = await authRequest('POST', '/requests/req-1/accept', {
        contentId: UUID_CONTENT,
        changeDescription: 'AI-generated content',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.contentVersion).toBeDefined();
    });
  });

  describe('POST /requests/:requestId/reject', () => {
    it('returns 200 on successful reject', async () => {
      mockRejectRequest.mockResolvedValue({ id: 'req-1', status: 'rejected' });

      const res = await authRequest('POST', '/requests/req-1/reject', {
        reason: 'Not helpful',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /requests/:requestId/cancel', () => {
    it('returns 200 on successful cancel', async () => {
      mockCancelRequest.mockResolvedValue({ id: 'req-1', status: 'cancelled' });

      const res = await authRequest('POST', '/requests/req-1/cancel', {});

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // ==========================================
  // Conversation Management
  // ==========================================
  describe('GET /conversation', () => {
    it('returns null when no active conversation', async () => {
      mockGetActive.mockResolvedValue(null);

      const res = await authRequest('GET', '/conversation?branchId=00000000-0000-4000-8000-000000000010');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversation).toBeNull();
    });

    it('returns active conversation with requests', async () => {
      const mockConversation = {
        id: 'conv-1',
        branchId: UUID_BRANCH,
        status: 'active',
        turnCount: 2,
        maxTurns: 20,
        createdAt: new Date(),
        requests: [
          {
            id: 'req-1',
            requestType: 'generation',
            prompt: 'Hello',
            generatedContent: 'World',
            status: 'accepted',
            createdAt: new Date(),
          },
        ],
      };
      mockGetActive.mockResolvedValue(mockConversation);

      const res = await authRequest('GET', '/conversation?branchId=00000000-0000-4000-8000-000000000010');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.conversation.id).toBe('conv-1');
      expect(json.conversation.turnCount).toBe(2);
      expect(json.conversation.requests).toHaveLength(1);
    });

    it('returns 400 when branchId is missing', async () => {
      const res = await authRequest('GET', '/conversation');

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /conversation/:conversationId', () => {
    it('returns 200 when conversation is ended successfully', async () => {
      mockGetById.mockResolvedValue({
        id: 'conv-1',
        userId: UUID_USER,
        status: 'active',
      });
      mockEnd.mockResolvedValue(undefined);

      const res = await authRequest('DELETE', '/conversation/conv-1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('returns 404 when conversation not found', async () => {
      mockGetById.mockResolvedValue(null);

      const res = await authRequest('DELETE', '/conversation/nonexistent');

      expect(res.status).toBe(404);
    });

    it('returns 403 when conversation belongs to another user', async () => {
      mockGetById.mockResolvedValue({
        id: 'conv-1',
        userId: 'other-user-id',
        status: 'active',
      });

      const res = await authRequest('DELETE', '/conversation/conv-1');

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // Request Retrieval
  // ==========================================
  describe('GET /requests/:requestId', () => {
    it('returns request detail for authorized user', async () => {
      mockGetRequestForUser.mockResolvedValue({
        id: 'req-1',
        conversationId: 'conv-1',
        requestType: 'generation',
        prompt: 'Hello',
        selectedText: null,
        generatedContent: 'World',
        status: 'pending',
        providerId: 'echo',
        modelId: 'echo-v1',
        tokensUsed: 42,
        createdAt: new Date(),
      });

      const res = await authRequest('GET', '/requests/req-1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.request.id).toBe('req-1');
      expect(json.request.requestType).toBe('generation');
      expect(json.request.status).toBe('pending');
    });
  });

  // ==========================================
  // Unauthenticated Access
  // ==========================================
  describe('Authentication enforcement', () => {
    it('returns 401 for unauthenticated requests', async () => {
      _currentAuthUser = null;
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/ai/conversation?branchId=00000000-0000-4000-8000-000000000010', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // Attribution Chain
  // ==========================================
  describe('Accept → Version Attribution', () => {
    it('creates version with authorType=system on accept', async () => {
      const { versionService } = await import('../../src/services/content/version-service');

      mockAcceptRequest.mockResolvedValue({
        id: 'req-1',
        status: 'accepted',
        generatedContent: 'AI text',
        conversationId: 'conv-1',
        providerId: 'echo',
        modelId: 'echo-v1',
      });

      await authRequest('POST', '/requests/req-1/accept', {
        contentId: UUID_CONTENT,
      });

      expect(versionService.createVersion).toHaveBeenCalledWith(
        UUID_CONTENT,
        expect.objectContaining({
          body: 'AI text',
          changeDescription: 'AI-generated content',
        }),
        expect.objectContaining({
          userId: UUID_USER,
          authorType: 'system',
        })
      );
    });
  });
});
