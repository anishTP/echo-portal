import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock branch service
vi.mock('../../src/services/branch/branch-service', () => ({
  branchService: { getById: vi.fn() },
}));

// Mock version service
vi.mock('../../src/services/content/version-service', () => ({
  versionService: { createVersion: vi.fn() },
}));

// Mock content model
vi.mock('../../src/models/content', () => ({
  createMetadataSnapshot: vi.fn(),
}));

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: { create: vi.fn(), createBulk: vi.fn() },
}));

// Mock AI service
vi.mock('../../src/services/ai/ai-service', () => ({
  aiService: {
    generate: vi.fn(),
    transform: vi.fn(),
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
    cancelRequest: vi.fn(),
    getRequestForUser: vi.fn(),
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
vi.mock('../../src/services/ai/conversation-service', () => ({
  conversationService: {
    getActive: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    end: vi.fn(),
    cleanupExpired: vi.fn(),
    discardBySession: vi.fn(),
  },
}));

// Mock config service
vi.mock('../../src/services/ai/ai-config-service', () => ({
  aiConfigService: {
    isEnabled: vi.fn().mockResolvedValue(true),
    getEffectiveLimits: vi.fn().mockResolvedValue({ maxTokens: 4000 }),
    get: vi.fn(),
    update: vi.fn(),
    getFullConfig: vi.fn().mockResolvedValue({}),
  },
}));

// Mock rate limiter
vi.mock('../../src/services/ai/rate-limiter', () => ({
  aiRateLimiter: { checkLimit: vi.fn().mockResolvedValue({ allowed: true }) },
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

// Mock context document service
const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../src/services/ai/ai-context-service', () => ({
  aiContextDocumentService: {
    list: (...args: any[]) => mockList(...args),
    getById: (...args: any[]) => mockGetById(...args),
    getEnabled: vi.fn().mockResolvedValue([]),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

// UUIDs for test data
const UUID_ADMIN = '00000000-0000-4000-8000-000000000001';
const UUID_NON_ADMIN = '00000000-0000-4000-8000-000000000002';
const UUID_DOC = '00000000-0000-4000-8000-000000000100';
const UUID_DOC_2 = '00000000-0000-4000-8000-000000000101';

const adminUser = {
  id: UUID_ADMIN,
  email: 'admin@example.com',
  displayName: 'Admin User',
  roles: ['administrator'],
  isActive: true,
  status: 'active',
};

const contributorUser = {
  id: UUID_NON_ADMIN,
  email: 'contributor@example.com',
  displayName: 'Contributor User',
  roles: ['contributor'],
  isActive: true,
  status: 'active',
};

// Track current auth user for db mock
let _currentAuthUser: any = null;

// Mock database — must handle auth middleware's user lookup
vi.mock('../../src/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
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
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'updated-id' }]),
        }),
      }),
    }),
    query: {},
  };
  return {
    db: mockDb,
    schema: {},
  };
});

import { validateSession } from '../../src/services/auth/session';

function authAs(user: any) {
  _currentAuthUser = user;

  (validateSession as any).mockResolvedValue({
    id: 'session-1',
    userId: user.id,
    token: 'test-token',
    expiresAt: new Date(Date.now() + 86400000),
  });
}

function request(method: string, path: string, body?: any) {
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
  // Avoid trailing slash: /api/v1/ai/context-documents + '/' would 404 in Hono
  const base = '/api/v1/ai/context-documents';
  const url = path === '/' ? base : `${base}${path}`;
  return app.request(url, options);
}

describe('AI Context Documents Routes — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _currentAuthUser = null;
  });

  // ==========================================
  // GET / — List all context documents
  // ==========================================
  describe('GET /', () => {
    it('returns list of documents for admin (200)', async () => {
      authAs(adminUser);

      const mockDocs = [
        {
          id: UUID_DOC,
          title: 'Brand Guidelines',
          content: 'Be professional and consistent.',
          enabled: true,
          sortOrder: 0,
          createdBy: UUID_ADMIN,
          updatedBy: UUID_ADMIN,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: UUID_DOC_2,
          title: 'Tone of Voice',
          content: 'Friendly but authoritative.',
          enabled: true,
          sortOrder: 1,
          createdBy: UUID_ADMIN,
          updatedBy: UUID_ADMIN,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockList.mockResolvedValue(mockDocs);

      const res = await request('GET', '/');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].title).toBe('Brand Guidelines');
      expect(json.data[1].title).toBe('Tone of Voice');
      expect(mockList).toHaveBeenCalledOnce();
    });

    it('requires admin role — returns 403 for non-admin user', async () => {
      authAs(contributorUser);

      const res = await request('GET', '/');

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockList).not.toHaveBeenCalled();
    });

    it('returns 401 for unauthenticated request', async () => {
      _currentAuthUser = null;
      (validateSession as any).mockResolvedValue(null);

      const res = await app.request('/api/v1/ai/context-documents', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // POST / — Create a context document
  // ==========================================
  describe('POST /', () => {
    it('creates a document and returns 201', async () => {
      authAs(adminUser);

      const createdDoc = {
        id: UUID_DOC,
        title: 'Brand Guidelines',
        content: 'Be professional.',
        enabled: true,
        sortOrder: 0,
        createdBy: UUID_ADMIN,
        updatedBy: UUID_ADMIN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockCreate.mockResolvedValue(createdDoc);

      const res = await request('POST', '/', {
        title: 'Brand Guidelines',
        content: 'Be professional.',
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.id).toBe(UUID_DOC);
      expect(json.data.title).toBe('Brand Guidelines');
      expect(json.data.content).toBe('Be professional.');
      expect(mockCreate).toHaveBeenCalledWith(
        { title: 'Brand Guidelines', content: 'Be professional.' },
        UUID_ADMIN
      );
    });

    it('creates a document with optional sortOrder', async () => {
      authAs(adminUser);

      const createdDoc = {
        id: UUID_DOC,
        title: 'Second Doc',
        content: 'Content here.',
        enabled: true,
        sortOrder: 5,
        createdBy: UUID_ADMIN,
        updatedBy: UUID_ADMIN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockCreate.mockResolvedValue(createdDoc);

      const res = await request('POST', '/', {
        title: 'Second Doc',
        content: 'Content here.',
        sortOrder: 5,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.sortOrder).toBe(5);
      expect(mockCreate).toHaveBeenCalledWith(
        { title: 'Second Doc', content: 'Content here.', sortOrder: 5 },
        UUID_ADMIN
      );
    });

    it('returns 400 when required fields are missing', async () => {
      authAs(adminUser);

      // Missing both title and content
      const res = await request('POST', '/', {});

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 400 when title is empty string', async () => {
      authAs(adminUser);

      const res = await request('POST', '/', {
        title: '',
        content: 'Some content.',
      });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 400 when content is empty string', async () => {
      authAs(adminUser);

      const res = await request('POST', '/', {
        title: 'Valid Title',
        content: '',
      });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('requires admin role — returns 403 for non-admin user', async () => {
      authAs(contributorUser);

      const res = await request('POST', '/', {
        title: 'Brand Guidelines',
        content: 'Be professional.',
      });

      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // PUT /:id — Update a context document
  // ==========================================
  describe('PUT /:id', () => {
    it('updates a document and returns 200', async () => {
      authAs(adminUser);

      const updatedDoc = {
        id: UUID_DOC,
        title: 'Updated Guidelines',
        content: 'Updated content.',
        enabled: true,
        sortOrder: 0,
        createdBy: UUID_ADMIN,
        updatedBy: UUID_ADMIN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockUpdate.mockResolvedValue(updatedDoc);

      const res = await request('PUT', `/${UUID_DOC}`, {
        title: 'Updated Guidelines',
        content: 'Updated content.',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.title).toBe('Updated Guidelines');
      expect(json.data.content).toBe('Updated content.');
      expect(mockUpdate).toHaveBeenCalledWith(
        UUID_DOC,
        { title: 'Updated Guidelines', content: 'Updated content.' },
        UUID_ADMIN
      );
    });

    it('updates enabled field', async () => {
      authAs(adminUser);

      const updatedDoc = {
        id: UUID_DOC,
        title: 'Brand Guidelines',
        content: 'Be professional.',
        enabled: false,
        sortOrder: 0,
        createdBy: UUID_ADMIN,
        updatedBy: UUID_ADMIN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockUpdate.mockResolvedValue(updatedDoc);

      const res = await request('PUT', `/${UUID_DOC}`, {
        enabled: false,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.enabled).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith(
        UUID_DOC,
        { enabled: false },
        UUID_ADMIN
      );
    });

    it('returns 404 when document does not exist', async () => {
      authAs(adminUser);

      mockUpdate.mockResolvedValue(undefined);

      const res = await request('PUT', `/${UUID_DOC}`, {
        title: 'Does Not Matter',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid UUID in path', async () => {
      authAs(adminUser);

      const res = await request('PUT', '/not-a-valid-uuid', {
        title: 'Updated',
      });

      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('requires admin role — returns 403 for non-admin user', async () => {
      authAs(contributorUser);

      const res = await request('PUT', `/${UUID_DOC}`, {
        title: 'Updated',
      });

      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // DELETE /:id — Delete a context document
  // ==========================================
  describe('DELETE /:id', () => {
    it('deletes a document and returns 200', async () => {
      authAs(adminUser);

      mockGetById.mockResolvedValue({
        id: UUID_DOC,
        title: 'Brand Guidelines',
        content: 'Be professional.',
        enabled: true,
        sortOrder: 0,
      });
      mockDelete.mockResolvedValue(true);

      const res = await request('DELETE', `/${UUID_DOC}`);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockGetById).toHaveBeenCalledWith(UUID_DOC);
      expect(mockDelete).toHaveBeenCalledWith(UUID_DOC);
    });

    it('returns 404 when document does not exist', async () => {
      authAs(adminUser);

      mockGetById.mockResolvedValue(undefined);

      const res = await request('DELETE', `/${UUID_DOC}`);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid UUID in path', async () => {
      authAs(adminUser);

      const res = await request('DELETE', '/not-a-valid-uuid');

      expect(res.status).toBe(400);
      expect(mockGetById).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('requires admin role — returns 403 for non-admin user', async () => {
      authAs(contributorUser);

      const res = await request('DELETE', `/${UUID_DOC}`);

      expect(res.status).toBe(403);
      expect(mockGetById).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
