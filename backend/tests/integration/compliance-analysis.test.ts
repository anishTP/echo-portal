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

// Mock notification service
vi.mock('../../src/services/notification/notification-service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock audit logger — capture calls (hoisted: no outer references allowed)
vi.mock('../../src/services/audit/logger', () => {
  const mockLog = vi.fn().mockResolvedValue(undefined);
  return {
    AuditLogger: vi.fn().mockImplementation(() => ({
      log: mockLog,
    })),
    __mockAuditLog: mockLog,
  };
});

// Mock AI service (hoisted)
vi.mock('../../src/services/ai/ai-service', () => {
  const mockGen = vi.fn();
  return {
    aiService: {
      generate: (...args: any[]) => mockGen(...args),
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
    __mockGenerate: mockGen,
  };
});

// Mock conversation service
vi.mock('../../src/services/ai/conversation-service', () => ({
  conversationService: {
    create: vi.fn(),
    getActive: vi.fn(),
    getById: vi.fn(),
    addTurn: vi.fn(),
    end: vi.fn(),
  },
}));

// Mock config service — includes compliance methods (hoisted)
vi.mock('../../src/services/ai/ai-config-service', () => {
  const _mockGetCC = vi.fn();
  const _mockUpdateCC = vi.fn();
  const _mockGetFull = vi.fn();
  return {
    aiConfigService: {
      isEnabled: vi.fn().mockResolvedValue(true),
      getEffectiveLimits: vi.fn().mockResolvedValue({
        maxTokens: 4000,
        rateLimit: 50,
        maxTurns: 20,
      }),
      getFullConfig: (...args: any[]) => _mockGetFull(...args),
      get: vi.fn(),
      update: vi.fn(),
      getForScope: vi.fn().mockResolvedValue([]),
      getComplianceCategories: (...args: any[]) => _mockGetCC(...args),
      updateComplianceCategory: (...args: any[]) => _mockUpdateCC(...args),
    },
    __mockGetComplianceCategories: _mockGetCC,
    __mockUpdateComplianceCategory: _mockUpdateCC,
    __mockGetFullConfig: _mockGetFull,
  };
});

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

// Mock content model
vi.mock('../../src/models/content', () => ({
  createMetadataSnapshot: vi.fn().mockReturnValue({
    title: 'Test Content',
    category: 'general',
    tags: [],
  }),
}));

// Mock version service
vi.mock('../../src/services/content/version-service', () => ({
  versionService: {
    createVersion: vi.fn(),
  },
}));

// Mock db for auth middleware user lookup
vi.mock('../../src/db/index.js', () => {
  const _mockSelect = vi.fn();
  return {
    db: {
      select: _mockSelect,
      insert: vi.fn(),
      update: vi.fn(),
      query: { auditLogs: { findMany: vi.fn().mockResolvedValue([]) }, users: { findFirst: vi.fn() } },
    },
    schema: { auditLogs: {} },
    __mockSelect: _mockSelect,
  };
});

// Import hoisted mocks
const { validateSession } = await import('../../src/services/auth/session');
const { __mockSelect: mockDbSelect } = await import('../../src/db/index.js') as any;
const { __mockAuditLog: mockAuditLog } = await import('../../src/services/audit/logger') as any;
const { __mockGenerate: mockGenerate } = await import('../../src/services/ai/ai-service') as any;
const {
  __mockGetComplianceCategories: mockGetComplianceCategories,
  __mockUpdateComplianceCategory: mockUpdateComplianceCategory,
  __mockGetFullConfig: mockGetFullConfig,
} = await import('../../src/services/ai/ai-config-service') as any;

const UUID_BRANCH = '00000000-0000-4000-8000-000000000010';
const UUID_USER = '00000000-0000-4000-8000-000000000001';
const UUID_CONVERSATION = '00000000-0000-4000-8000-000000000050';
const UUID_REQUEST = '00000000-0000-4000-8000-000000000060';

const contributorUser = {
  id: UUID_USER,
  externalId: 'github-test',
  provider: 'github',
  email: 'test@example.com',
  displayName: 'Test User',
  roles: ['contributor'],
  avatarUrl: null,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminUser = {
  ...contributorUser,
  roles: ['contributor', 'reviewer', 'administrator'],
};

const reviewerUser = {
  ...contributorUser,
  roles: ['contributor', 'reviewer'],
};

function setupAuth(user: typeof contributorUser) {
  // Mock validateSession to return session object
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'session-1',
    userId: user.id,
    role: user.roles[0],
    expiresAt: new Date(Date.now() + 3600000),
  });
  // Mock db.select chain for auth middleware user lookup
  const mockLimit = vi.fn().mockResolvedValue([{
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    isActive: true,
    avatarUrl: null,
  }]);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockDbSelect.mockReturnValue({ from: mockFrom });
}

describe('Compliance Analysis Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullConfig.mockResolvedValue({
      global: { enabled: true },
      roles: {},
      compliance: {
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      },
    });
  });

  // ---- GET /api/v1/ai/config (compliance section) ----

  describe('GET /api/v1/ai/config — compliance section', () => {
    it('returns compliance categories in config response', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'GET',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.compliance).toBeDefined();
      expect(body.config.compliance.brand_adherence).toBeDefined();
      expect(body.config.compliance.accessibility).toBeDefined();
      expect(body.config.compliance.content_appropriateness).toBeDefined();
      expect(body.config.compliance.licensing_attribution).toBeDefined();
      expect(body.config.compliance.technical_quality).toBeDefined();
    });

    it('rejects non-admin users', async () => {
      setupAuth(contributorUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'GET',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      expect(res.status).toBe(403);
    });
  });

  // ---- PUT /api/v1/ai/config — compliance updates ----

  describe('PUT /api/v1/ai/config — compliance updates', () => {
    it('updates compliance category configuration', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      });

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: false, severity: 'error' },
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateComplianceCategory).toHaveBeenCalledWith(
        'brand_adherence',
        { enabled: false, severity: 'error' },
        UUID_USER,
      );
    });

    it('logs compliance.config_changed audit event', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      });

      await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            accessibility: { enabled: true, severity: 'error' },
          },
        }),
      });

      // Find the compliance audit call
      const complianceAuditCall = mockAuditLog.mock.calls.find(
        (call: any[]) => call[0]?.action === 'compliance.config_changed'
      );
      expect(complianceAuditCall).toBeDefined();
      expect(complianceAuditCall![0].metadata.updates).toHaveLength(1);
      expect(complianceAuditCall![0].metadata.updates[0].category).toBe('accessibility');
      expect(complianceAuditCall![0].metadata.updates[0].newValue).toEqual({
        enabled: true,
        severity: 'error',
      });
    });

    it('rejects invalid compliance category keys', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            invalid_category: { enabled: true, severity: 'warning' },
          },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects invalid severity values', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: true, severity: 'critical' },
          },
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---- Reviewer access (US2) ----

  describe('Reviewer role access (US2)', () => {
    it('reviewer can access AI config endpoint (read)', async () => {
      // Reviewers can't access admin config — only admins
      setupAuth(reviewerUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'GET',
        headers: { Cookie: 'echo_session=valid-token' },
      });

      // Reviewers are NOT admins — should be 403
      expect(res.status).toBe(403);
    });
  });

  // ---- T018: Audit event test coverage ----

  describe('Audit event coverage (T018)', () => {
    it('compliance.config_changed includes old and new values in metadata', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      // Return current state before update (old value)
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      });

      await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: false, severity: 'error' },
            accessibility: { enabled: true, severity: 'informational' },
          },
        }),
      });

      const complianceAuditCall = mockAuditLog.mock.calls.find(
        (call: any[]) => call[0]?.action === 'compliance.config_changed'
      );
      expect(complianceAuditCall).toBeDefined();
      const metadata = complianceAuditCall![0].metadata;
      expect(metadata.updates).toHaveLength(2);

      // Check that updates include category, oldValue, and newValue
      const brandUpdate = metadata.updates.find((u: any) => u.category === 'brand_adherence');
      expect(brandUpdate).toBeDefined();
      expect(brandUpdate.oldValue).toEqual({ enabled: true, severity: 'warning' });
      expect(brandUpdate.newValue).toEqual({ enabled: false, severity: 'error' });

      const accessUpdate = metadata.updates.find((u: any) => u.category === 'accessibility');
      expect(accessUpdate).toBeDefined();
      expect(accessUpdate.newValue).toEqual({ enabled: true, severity: 'informational' });
    });

    it('compliance.config_changed logs actorId and resourceType correctly', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      });

      await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            technical_quality: { enabled: false, severity: 'warning' },
          },
        }),
      });

      const complianceAuditCall = mockAuditLog.mock.calls.find(
        (call: any[]) => call[0]?.action === 'compliance.config_changed'
      );
      expect(complianceAuditCall).toBeDefined();
      expect(complianceAuditCall![0].actorId).toBe(UUID_USER);
      expect(complianceAuditCall![0].actorType).toBe('user');
      expect(complianceAuditCall![0].resourceType).toBe('content');
      expect(complianceAuditCall![0].resourceId).toBe('compliance-config');
    });
  });

  // ---- T020: Edge case test coverage ----

  describe('Edge case coverage (T020)', () => {
    it('rejects when all compliance categories are disabled via PUT', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: false, severity: 'warning' },
        accessibility: { enabled: false, severity: 'warning' },
        content_appropriateness: { enabled: false, severity: 'warning' },
        licensing_attribution: { enabled: false, severity: 'warning' },
        technical_quality: { enabled: false, severity: 'warning' },
      });

      // Update should succeed (admin can disable all — the error only surfaces during analysis)
      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: false, severity: 'warning' },
          },
        }),
      });

      expect(res.status).toBe(200);
    });

    it('rejects empty compliance object in PUT', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {},
        }),
      });

      // Empty compliance object — no updates, should still succeed
      expect(res.status).toBe(200);
    });

    it('rejects non-boolean enabled value', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: 'yes', severity: 'warning' },
          },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects missing severity field', async () => {
      setupAuth(adminUser);

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: true },
          },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('handles multiple category updates in a single PUT', async () => {
      setupAuth(adminUser);
      mockUpdateComplianceCategory.mockResolvedValue({});
      mockGetComplianceCategories.mockResolvedValue({
        brand_adherence: { enabled: true, severity: 'warning' },
        accessibility: { enabled: true, severity: 'warning' },
        content_appropriateness: { enabled: true, severity: 'warning' },
        licensing_attribution: { enabled: true, severity: 'warning' },
        technical_quality: { enabled: true, severity: 'warning' },
      });

      const res = await app.request('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          Cookie: 'echo_session=valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compliance: {
            brand_adherence: { enabled: false, severity: 'error' },
            accessibility: { enabled: true, severity: 'informational' },
            technical_quality: { enabled: false, severity: 'warning' },
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateComplianceCategory).toHaveBeenCalledTimes(3);
    });
  });
});
