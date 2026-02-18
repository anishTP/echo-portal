import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../src/api/index';

// Mock session validation
vi.mock('../../src/services/auth/session', () => ({
  validateSession: vi.fn(),
  createSession: vi.fn(),
  invalidateUserSessionCache: vi.fn(),
}));

// Mock database
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock branch service (used by assertDraftBranch)
vi.mock('../../src/services/branch/branch-service', () => ({
  branchService: {
    getById: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('../../src/services/audit/logger', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { db } from '../../src/db';

const UUID_CATEGORY_1 = '00000000-0000-4000-a000-000000000010';
const UUID_CATEGORY_2 = '00000000-0000-4000-a000-000000000011';
const UUID_SUBCATEGORY_1 = '00000000-0000-4000-a000-000000000020';
const UUID_SUBCATEGORY_2 = '00000000-0000-4000-a000-000000000021';
const UUID_INVALID = 'not-a-uuid';

const mockSubcategory1 = {
  id: UUID_SUBCATEGORY_1,
  name: 'V1 Models',
  categoryId: UUID_CATEGORY_1,
  displayOrder: 0,
  createdBy: '00000000-0000-4000-a000-000000000001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockSubcategory2 = {
  id: UUID_SUBCATEGORY_2,
  name: 'V2 Models',
  categoryId: UUID_CATEGORY_1,
  displayOrder: 1,
  createdBy: '00000000-0000-4000-a000-000000000001',
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

function selectChainOrdered(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('Subcategory API — GET /api/v1/subcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns subcategories for a valid categoryId', async () => {
    (db.select as any).mockReturnValueOnce(
      selectChainOrdered([mockSubcategory1, mockSubcategory2])
    );

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('V1 Models');
    expect(body.data[1].name).toBe('V2 Models');
    expect(body.data[0].categoryId).toBe(UUID_CATEGORY_1);
  });

  it('returns empty array when category has no subcategories', async () => {
    (db.select as any).mockReturnValueOnce(selectChainOrdered([]));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_2}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it('returns 400 for missing categoryId', async () => {
    const res = await app.request('/api/v1/subcategories');

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID format', async () => {
    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_INVALID}`
    );

    expect(res.status).toBe(400);
  });

  it('does not require authentication (public endpoint)', async () => {
    (db.select as any).mockReturnValueOnce(selectChainOrdered([]));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    // Should succeed without auth cookies
    expect(res.status).toBe(200);
  });

  it('returns subcategories ordered by displayOrder', async () => {
    const reversed = [
      { ...mockSubcategory2, displayOrder: 0 },
      { ...mockSubcategory1, displayOrder: 1 },
    ];
    (db.select as any).mockReturnValueOnce(selectChainOrdered(reversed));

    const res = await app.request(
      `/api/v1/subcategories?categoryId=${UUID_CATEGORY_1}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // The DB mock returns pre-ordered results, verifying the route passes them through
    expect(body.data[0].displayOrder).toBe(0);
    expect(body.data[1].displayOrder).toBe(1);
  });
});
