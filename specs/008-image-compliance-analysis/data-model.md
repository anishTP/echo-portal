# Data Model: AI-Powered Image Compliance Analysis

**Feature**: 008-image-compliance-analysis
**Date**: 2026-02-10

## Entity Overview

This feature introduces no new database tables. All data is stored using the existing `ai_configurations` table from 007-ai-assisted-authoring. Compliance analysis results are ephemeral, living within AI conversation records that already exist in 007's `ai_requests` and `ai_conversations` tables.

## Configuration Entity

### Compliance Category Configuration

Stored in the existing `ai_configurations` table using scope prefix `compliance`.

**Scope pattern**: `compliance`
**Keys**: One per compliance category

| Key | Default Value | Description |
|-----|---------------|-------------|
| `brand_adherence` | `{ "enabled": true, "severity": "warning" }` | Logo usage, colour palette, typography, layout conformance |
| `accessibility` | `{ "enabled": true, "severity": "warning" }` | Alt-text quality, contrast, text legibility, decorative vs informational |
| `content_appropriateness` | `{ "enabled": true, "severity": "warning" }` | Professional quality, relevance, no offensive imagery |
| `licensing_attribution` | `{ "enabled": true, "severity": "warning" }` | Watermarks, stock photo attribution, rights metadata |
| `technical_quality` | `{ "enabled": true, "severity": "warning" }` | Resolution, file size, format appropriateness |

**Value schema** (JSON stored in `ai_configurations.value` JSONB column):
```typescript
interface ComplianceCategoryConfig {
  enabled: boolean;
  severity: 'error' | 'warning' | 'informational';
}
```

**Validation rules**:
- `enabled` must be a boolean
- `severity` must be one of `'error'`, `'warning'`, `'informational'`
- If a category key does not exist in the database, the default value (enabled: true, severity: 'warning') is used

**Access pattern**:
- Read: `aiConfigService.getForScope('compliance')` → returns all category configs
- Write: `aiConfigService.update('compliance', 'brand_adherence', { enabled: false, severity: 'error' }, userId)` → upserts single category
- Default resolution: When a category key is absent, the application layer provides defaults

## Shared Types

### New types to add to `shared/types/ai.ts`

```typescript
export const COMPLIANCE_CATEGORIES = [
  'brand_adherence',
  'accessibility',
  'content_appropriateness',
  'licensing_attribution',
  'technical_quality',
] as const;

export type ComplianceCategory = typeof COMPLIANCE_CATEGORIES[number];

export type ComplianceSeverity = 'error' | 'warning' | 'informational';

export interface ComplianceCategoryConfig {
  enabled: boolean;
  severity: ComplianceSeverity;
}

export const COMPLIANCE_DEFAULTS: Record<ComplianceCategory, ComplianceCategoryConfig> = {
  brand_adherence: { enabled: true, severity: 'warning' },
  accessibility: { enabled: true, severity: 'warning' },
  content_appropriateness: { enabled: true, severity: 'warning' },
  licensing_attribution: { enabled: true, severity: 'warning' },
  technical_quality: { enabled: true, severity: 'warning' },
};

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  brand_adherence: 'Brand Adherence',
  accessibility: 'Accessibility',
  content_appropriateness: 'Content Appropriateness',
  licensing_attribution: 'Licensing & Attribution',
  technical_quality: 'Technical Quality',
};

export const COMPLIANCE_CATEGORY_DESCRIPTIONS: Record<ComplianceCategory, string> = {
  brand_adherence: 'Logo usage, colour palette, typography, and layout conformance',
  accessibility: 'Alt-text quality, contrast ratios, text legibility, and decorative vs informational classification',
  content_appropriateness: 'Professional quality, relevance to context, and absence of offensive imagery',
  licensing_attribution: 'Watermark detection, stock photo attribution, and rights metadata presence',
  technical_quality: 'Resolution adequacy, file size optimisation, and format appropriateness',
};
```

## Existing Tables Used (No Modifications)

### `ai_configurations` (from 007)

| Column | Type | Usage for Compliance |
|--------|------|---------------------|
| `id` | UUID PK | Auto-generated |
| `scope` | text | `'compliance'` for all category configs |
| `key` | text | Category identifier (e.g., `'brand_adherence'`) |
| `value` | jsonb | `ComplianceCategoryConfig` object |
| `updatedBy` | UUID FK → users | Admin who last changed it |
| `updatedAt` | timestamp | Last modification time |
| `createdAt` | timestamp | First creation time |

**Unique constraint**: `(scope, key)` — ensures one config per category

### `ai_requests` (from 007)

Compliance analysis requests are stored as regular AI requests with:
- `requestType`: `'generation'` (same as regular `/analyse`)
- `responseMode`: `'analyse'`
- Images passed via the existing `images` parameter
- No schema changes needed

### `ai_conversations` (from 007)

Compliance conversations are regular AI conversations. No schema changes needed.

### `audit_logs` (from 002)

Compliance audit events use the existing audit log table with:
- `action`: `'compliance.analysis_requested'`, `'compliance.config_changed'`
- `metadata`: JSONB with compliance-specific details (image count, categories, severity changes)
- No schema changes needed

## Database Migrations

**None required.** This feature uses only existing tables and columns.

## Indexes

**No new indexes required.** The existing `ai_config_scope_key_idx` unique index on `(scope, key)` already supports efficient lookup of compliance category configurations.
