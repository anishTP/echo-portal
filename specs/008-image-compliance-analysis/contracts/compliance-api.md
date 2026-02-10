# API Contract: Image Compliance Analysis

**Feature**: 008-image-compliance-analysis
**Date**: 2026-02-10

## Overview

This feature adds no new API endpoints. It modifies the behaviour of two existing endpoints and extends one existing admin endpoint.

## Modified Endpoints

### POST `/api/v1/ai/generate` (Existing — Behaviour Change)

**Change**: When `mode` is `'analyse'` and `images` array is non-empty, the backend uses compliance-specific system prompts instead of the generic analysis prompt.

**Request** (unchanged schema from 007):
```typescript
{
  branchId: string;          // UUID, required
  contentId?: string;        // UUID, optional
  prompt: string;            // 1-10000 chars, required — user's instruction alongside /analyse
  conversationId?: string;   // UUID, optional — multi-turn
  context?: string;          // max 200KB, optional — document body
  mode?: 'add' | 'replace' | 'analyse';  // required for compliance: 'analyse'
  selectedText?: string;     // max 50KB, optional
  cursorContext?: string;    // max 5KB, optional
  images?: Array<{           // required for compliance: at least 1 image
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;            // base64, max 7MB
  }>;                        // max 4 images
}
```

**Response** (unchanged — SSE stream):
```
event: meta
data: { "requestId": "uuid", "conversationId": "uuid", "providerId": "anthropic", "modelId": "claude-sonnet-4-20250514" }

event: token
data: { "content": "## Brand Adherence\n\n" }

event: token
data: { "content": "**Severity**: Warning\n" }

... (structured compliance findings streamed as markdown)

event: done
data: { "requestId": "uuid", "tokensUsed": 1200, "fullContent": "..." }
```

**Compliance detection logic** (backend only):
```
IF mode === 'analyse' AND images.length > 0:
  → Use compliance system prompt (buildComplianceSystemPrompt)
  → Inject enabled categories with configured severities
  → Inject context documents as reference materials
  → Log audit event: compliance.analysis_requested
ELSE:
  → Existing behaviour unchanged
```

**Error responses** (unchanged from 007):
- `401` — Unauthenticated
- `403` — Not authorised for this branch
- `429` — Rate limit exceeded
- `400` — Validation error

**New error case**:
- `400` — `{ "error": { "code": "COMPLIANCE_DISABLED", "message": "All compliance categories are disabled" } }` when `mode === 'analyse'`, images are present, and all categories are disabled by administrator

### GET `/api/v1/ai/config` (Existing — Extended Response)

**Change**: Response includes compliance category configuration alongside existing global/role settings.

**Response** (extended):
```typescript
{
  config: {
    global: {
      enabled: boolean;
      max_tokens: number;
      rate_limit: number;
      max_turns: number;
    };
    roles: {
      [roleName: string]: {
        enabled?: boolean;
        // ... existing role overrides
      };
    };
    compliance: {                              // NEW
      brand_adherence: {
        enabled: boolean;
        severity: 'error' | 'warning' | 'informational';
      };
      accessibility: {
        enabled: boolean;
        severity: 'error' | 'warning' | 'informational';
      };
      content_appropriateness: {
        enabled: boolean;
        severity: 'error' | 'warning' | 'informational';
      };
      licensing_attribution: {
        enabled: boolean;
        severity: 'error' | 'warning' | 'informational';
      };
      technical_quality: {
        enabled: boolean;
        severity: 'error' | 'warning' | 'informational';
      };
    };
  }
}
```

**Default values**: When no compliance configuration exists in the database, the API returns defaults (all categories enabled at warning severity).

### PUT `/api/v1/ai/config` (Existing — Extended Request)

**Change**: Accepts compliance category updates alongside existing global/role settings.

**Request** (extended):
```typescript
{
  global?: { /* existing fields */ };
  roles?: { /* existing fields */ };
  compliance?: {                               // NEW
    [categoryKey: string]: {
      enabled: boolean;
      severity: 'error' | 'warning' | 'informational';
    };
  };
}
```

**Example request** (update only accessibility severity):
```json
{
  "compliance": {
    "accessibility": {
      "enabled": true,
      "severity": "error"
    }
  }
}
```

**Validation**:
- `categoryKey` must be one of: `brand_adherence`, `accessibility`, `content_appropriateness`, `licensing_attribution`, `technical_quality`
- `enabled` must be boolean
- `severity` must be one of: `error`, `warning`, `informational`
- Invalid keys return `400` with validation error

**Audit**: Logs `compliance.config_changed` with metadata including category, old value, new value.

## Frontend API Service Extensions

### `ai-api.ts` additions

```typescript
// Add to existing aiApi object:

getComplianceConfig: () =>
  api.get<{ config: { compliance: Record<string, ComplianceCategoryConfig> } }>('/ai/config'),

updateComplianceConfig: (categories: Record<string, ComplianceCategoryConfig>) =>
  apiFetch('/ai/config', {
    method: 'PUT',
    body: JSON.stringify({ compliance: categories }),
  }),
```

Note: These reuse the existing `/ai/config` endpoints — no new URLs. The frontend simply includes the `compliance` key in its existing save payload.

## Audit Events

### `compliance.analysis_requested`

Logged when `/analyse` is invoked with images.

```typescript
{
  action: 'compliance.analysis_requested',
  actorId: string,           // User who triggered the check
  actorType: 'user',
  resourceType: 'branch',
  resourceId: string,        // Branch ID
  metadata: {
    imageCount: number,
    enabledCategories: string[],
    providerId: string,
    conversationId: string,
  }
}
```

### `compliance.config_changed`

Logged when an administrator updates compliance category configuration.

```typescript
{
  action: 'compliance.config_changed',
  actorId: string,           // Administrator
  actorType: 'user',
  resourceType: 'content',
  resourceId: 'compliance-config',
  metadata: {
    updates: Array<{
      category: string,
      oldValue: ComplianceCategoryConfig | null,
      newValue: ComplianceCategoryConfig,
    }>
  }
}
```
