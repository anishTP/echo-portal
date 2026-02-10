import { describe, it, expect } from 'vitest';
import { buildComplianceSystemPrompt } from '../../src/services/ai/compliance-prompts';
import {
  COMPLIANCE_DEFAULTS,
  COMPLIANCE_CATEGORIES,
  type ComplianceCategory,
  type ComplianceCategoryConfig,
} from '@echo-portal/shared';

describe('buildComplianceSystemPrompt', () => {
  it('includes all enabled categories with correct severity', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);

    expect(prompt).toContain('Brand Adherence');
    expect(prompt).toContain('Accessibility');
    expect(prompt).toContain('Content Appropriateness');
    expect(prompt).toContain('Licensing Attribution');
    expect(prompt).toContain('Technical Quality');
    // All defaults are warning severity
    expect(prompt).toContain('Severity: warning');
  });

  it('excludes disabled categories', () => {
    const categories = {
      ...COMPLIANCE_DEFAULTS,
      brand_adherence: { enabled: false, severity: 'warning' as const },
      technical_quality: { enabled: false, severity: 'warning' as const },
    };
    const prompt = buildComplianceSystemPrompt(categories);

    expect(prompt).not.toContain('Brand Adherence');
    expect(prompt).not.toContain('Technical Quality');
    expect(prompt).toContain('Accessibility');
    expect(prompt).toContain('Content Appropriateness');
    expect(prompt).toContain('Licensing Attribution');
  });

  it('reflects configured severity levels', () => {
    const categories: Record<ComplianceCategory, ComplianceCategoryConfig> = {
      brand_adherence: { enabled: true, severity: 'error' },
      accessibility: { enabled: true, severity: 'informational' },
      content_appropriateness: { enabled: false, severity: 'warning' },
      licensing_attribution: { enabled: true, severity: 'warning' },
      technical_quality: { enabled: true, severity: 'error' },
    };
    const prompt = buildComplianceSystemPrompt(categories);

    expect(prompt).toContain('Brand Adherence** (Severity: error)');
    expect(prompt).toContain('Accessibility** (Severity: informational)');
    expect(prompt).toContain('Licensing Attribution** (Severity: warning)');
    expect(prompt).toContain('Technical Quality** (Severity: error)');
    // content_appropriateness is disabled, should not appear
    expect(prompt).not.toContain('Content Appropriateness');
  });

  it('includes category instructions', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);

    expect(prompt).toContain('logo usage');
    expect(prompt).toContain('alt-text quality');
    expect(prompt).toContain('watermarks');
    expect(prompt).toContain('resolution adequacy');
    expect(prompt).toContain('professional quality');
  });

  it('includes structured output instructions', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);

    expect(prompt).toContain('**Category**');
    expect(prompt).toContain('**Severity**');
    expect(prompt).toContain('**Issue**');
    expect(prompt).toContain('**Remediation**');
  });

  it('includes multi-image attribution instruction', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);
    expect(prompt).toContain('clearly identify which image');
  });

  it('includes compliance pass instruction', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);
    expect(prompt).toContain('image is compliant');
  });

  it('appends context documents as reference materials', () => {
    const docs = [
      { title: 'Brand Guidelines', content: 'Use blue #0066CC for headers' },
      { title: 'Style Guide', content: 'All images must be 16:9 ratio' },
    ];
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS, docs);

    expect(prompt).toContain('--- Reference Materials ---');
    expect(prompt).toContain('## Brand Guidelines');
    expect(prompt).toContain('Use blue #0066CC for headers');
    expect(prompt).toContain('## Style Guide');
    expect(prompt).toContain('All images must be 16:9 ratio');
    expect(prompt).toContain('--- End Reference Materials ---');
  });

  it('omits reference block when no context documents', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS);
    expect(prompt).not.toContain('--- Reference Materials ---');
  });

  it('omits reference block for empty array', () => {
    const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS, []);
    expect(prompt).not.toContain('--- Reference Materials ---');
  });

  it('handles only one enabled category', () => {
    const categories: Record<ComplianceCategory, ComplianceCategoryConfig> = {
      brand_adherence: { enabled: false, severity: 'warning' },
      accessibility: { enabled: true, severity: 'error' },
      content_appropriateness: { enabled: false, severity: 'warning' },
      licensing_attribution: { enabled: false, severity: 'warning' },
      technical_quality: { enabled: false, severity: 'warning' },
    };
    const prompt = buildComplianceSystemPrompt(categories);

    expect(prompt).toContain('Accessibility');
    expect(prompt).toContain('Severity: error');
    // Only one severity in the output format line
    expect(prompt).toContain('**Severity**: error');
  });

  it('lists unique severities in output format instructions', () => {
    const categories: Record<ComplianceCategory, ComplianceCategoryConfig> = {
      brand_adherence: { enabled: true, severity: 'error' },
      accessibility: { enabled: true, severity: 'warning' },
      content_appropriateness: { enabled: true, severity: 'informational' },
      licensing_attribution: { enabled: false, severity: 'warning' },
      technical_quality: { enabled: false, severity: 'warning' },
    };
    const prompt = buildComplianceSystemPrompt(categories);

    // Should list all unique severities
    expect(prompt).toContain('error or warning or informational');
  });

  // T020: Edge case coverage
  describe('Edge cases (T020)', () => {
    it('all categories disabled produces minimal valid prompt', () => {
      const categories: Record<ComplianceCategory, ComplianceCategoryConfig> = {
        brand_adherence: { enabled: false, severity: 'warning' },
        accessibility: { enabled: false, severity: 'warning' },
        content_appropriateness: { enabled: false, severity: 'warning' },
        licensing_attribution: { enabled: false, severity: 'warning' },
        technical_quality: { enabled: false, severity: 'warning' },
      };
      const prompt = buildComplianceSystemPrompt(categories);

      // Should still be a valid string (the service layer prevents calling this
      // when all disabled, but the builder should not crash)
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      // No category names should appear
      expect(prompt).not.toContain('Brand Adherence');
      expect(prompt).not.toContain('Accessibility');
    });

    it('no context documents produces valid prompt without reference block', () => {
      const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS, undefined);
      expect(prompt).not.toContain('--- Reference Materials ---');
      expect(prompt).toContain('compliance reviewer');
    });

    it('empty context documents array produces valid prompt without reference block', () => {
      const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS, []);
      expect(prompt).not.toContain('--- Reference Materials ---');
    });

    it('context documents with empty content are still included', () => {
      const docs = [{ title: 'Empty Guide', content: '' }];
      const prompt = buildComplianceSystemPrompt(COMPLIANCE_DEFAULTS, docs);
      expect(prompt).toContain('--- Reference Materials ---');
      expect(prompt).toContain('## Empty Guide');
    });

    it('all categories enabled with error severity', () => {
      const categories: Record<ComplianceCategory, ComplianceCategoryConfig> = {
        brand_adherence: { enabled: true, severity: 'error' },
        accessibility: { enabled: true, severity: 'error' },
        content_appropriateness: { enabled: true, severity: 'error' },
        licensing_attribution: { enabled: true, severity: 'error' },
        technical_quality: { enabled: true, severity: 'error' },
      };
      const prompt = buildComplianceSystemPrompt(categories);

      // All should appear with error severity
      expect(prompt).toContain('Brand Adherence** (Severity: error)');
      expect(prompt).toContain('Accessibility** (Severity: error)');
      // Only one unique severity in format line
      expect(prompt).toContain('**Severity**: error');
      expect(prompt).not.toContain('error or');
    });
  });
});
