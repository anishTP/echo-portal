import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMPLIANCE_DEFAULTS, COMPLIANCE_CATEGORIES, type ComplianceCategory } from '@echo-portal/shared';

// Mock db module
vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Import after mocking
const { AIConfigService } = await import('../../src/services/ai/ai-config-service.js');
const { db } = await import('../../src/db/index.js');

describe('AIConfigService — compliance methods', () => {
  let service: InstanceType<typeof AIConfigService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIConfigService();
  });

  describe('getComplianceCategories()', () => {
    it('returns defaults when no DB config exists', async () => {
      // Mock getForScope('compliance') → empty array
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await service.getComplianceCategories();

      expect(result).toEqual(COMPLIANCE_DEFAULTS);
      // All 5 categories present and enabled
      for (const cat of COMPLIANCE_CATEGORIES) {
        expect(result[cat]).toBeDefined();
        expect(result[cat].enabled).toBe(true);
        expect(result[cat].severity).toBe('warning');
      }
    });

    it('merges partial DB overrides with defaults', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { scope: 'compliance', key: 'brand_adherence', value: { enabled: false, severity: 'error' } },
          { scope: 'compliance', key: 'accessibility', value: { enabled: true, severity: 'informational' } },
        ]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await service.getComplianceCategories();

      // Overridden categories
      expect(result.brand_adherence).toEqual({ enabled: false, severity: 'error' });
      expect(result.accessibility).toEqual({ enabled: true, severity: 'informational' });
      // Default categories unchanged
      expect(result.content_appropriateness).toEqual({ enabled: true, severity: 'warning' });
      expect(result.licensing_attribution).toEqual({ enabled: true, severity: 'warning' });
      expect(result.technical_quality).toEqual({ enabled: true, severity: 'warning' });
    });

    it('ignores unknown keys in DB', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { scope: 'compliance', key: 'unknown_category', value: { enabled: true, severity: 'error' } },
        ]),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await service.getComplianceCategories();

      // Should return defaults only, ignoring unknown key
      expect(result).toEqual(COMPLIANCE_DEFAULTS);
      expect((result as Record<string, unknown>)['unknown_category']).toBeUndefined();
    });

    it('returns all categories with all disabled when DB says so', async () => {
      const disabledConfigs = COMPLIANCE_CATEGORIES.map((cat) => ({
        scope: 'compliance',
        key: cat,
        value: { enabled: false, severity: 'warning' },
      }));
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(disabledConfigs),
      });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await service.getComplianceCategories();

      for (const cat of COMPLIANCE_CATEGORIES) {
        expect(result[cat].enabled).toBe(false);
      }
    });
  });

  describe('updateComplianceCategory()', () => {
    it('delegates to update with compliance scope', async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        { id: 'config-1', scope: 'compliance', key: 'brand_adherence', value: { enabled: false, severity: 'error' } },
      ]);
      const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

      await service.updateComplianceCategory(
        'brand_adherence',
        { enabled: false, severity: 'error' },
        'user-123',
      );

      // Verify insert was called
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'compliance',
          key: 'brand_adherence',
          value: { enabled: false, severity: 'error' },
          updatedBy: 'user-123',
        }),
      );
    });
  });
});
