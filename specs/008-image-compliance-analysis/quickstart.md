# Quickstart: AI-Powered Image Compliance Analysis

**Feature**: 008-image-compliance-analysis
**Date**: 2026-02-10

## Overview

This feature extends 007's `/analyse` mode to perform image compliance analysis. When a user sends images with `/analyse`, the system detects the multimodal input and uses compliance-specific system prompts. The implementation requires:

1. A compliance prompt builder (new file)
2. Image detection in the analyse mode path (modify providers)
3. Compliance category configuration (extend existing config service)
4. Admin UI for categories (extend existing config panel)
5. Context menu extension for images (modify editor + context menu)

## Step 1: Add Shared Types

**File**: `shared/types/ai.ts`

Add compliance category types alongside existing AI types:

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
```

## Step 2: Build the Compliance Prompt Builder

**File**: `backend/src/services/ai/compliance-prompts.ts` (NEW)

Create a function that builds a compliance-specific system prompt from enabled categories, their severity levels, and context documents.

```typescript
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_DEFAULTS,
  type ComplianceCategory,
  type ComplianceCategoryConfig
} from '../../../../shared/types/ai';

const CATEGORY_INSTRUCTIONS: Record<ComplianceCategory, string> = {
  brand_adherence: 'Evaluate logo usage, colour palette adherence, typography consistency, and layout conformance against organisational brand guidelines',
  accessibility: 'Check alt-text quality, contrast ratios, text legibility within images, and whether decorative vs informational classification is appropriate',
  content_appropriateness: 'Assess professional quality, relevance to surrounding content context, and absence of offensive or inappropriate imagery',
  licensing_attribution: 'Check for watermarks, stock photo indicators, missing attribution, and rights metadata concerns',
  technical_quality: 'Evaluate resolution adequacy for display, file size optimisation, and format appropriateness (e.g., SVG for diagrams, WebP for photos)',
};

export function buildComplianceSystemPrompt(
  categories: Record<ComplianceCategory, ComplianceCategoryConfig>,
  contextDocuments?: Array<{ title: string; content: string }>,
): string {
  const enabledCategories = COMPLIANCE_CATEGORIES.filter(c => categories[c]?.enabled);

  const categoryBlock = enabledCategories.map(cat => {
    const config = categories[cat];
    return `- **${cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}** (Severity: ${config.severity}): ${CATEGORY_INSTRUCTIONS[cat]}`;
  }).join('\n');

  const refBlock = contextDocuments?.length
    ? `\n\n--- Reference Materials ---\n${contextDocuments.map(d => `## ${d.title}\n${d.content}`).join('\n\n')}\n--- End Reference Materials ---`
    : '';

  return `You are an image compliance reviewer for a documentation portal. Analyse the provided image(s) against the following compliance categories:

${categoryBlock}

For each issue found, structure your response as:
- **Category**: The compliance category name
- **Severity**: ${enabledCategories.map(c => categories[c].severity).filter((v, i, a) => a.indexOf(v) === i).join(' or ')}
- **Issue**: Clear description of the compliance concern
- **Remediation**: Specific action the author can take to resolve the issue

If multiple images are provided, clearly identify which image each finding relates to.

If the image passes all categories with no issues, confirm that the image is compliant.

You may use conversational language. If the user asks follow-up questions about specific findings, provide additional detail.${refBlock}`;
}
```

## Step 3: Extend Provider System Prompts

**File**: `backend/src/services/ai/providers/anthropic-provider.ts` (and `openai-provider.ts`)

In the `getGenerateSystemPrompt` function, modify the `'analyse'` case to check for images:

```typescript
// At the top of the file, import:
import { buildComplianceSystemPrompt } from '../compliance-prompts';
import { COMPLIANCE_DEFAULTS, type ComplianceCategory, type ComplianceCategoryConfig } from '../../../../../shared/types/ai';

// In getGenerateSystemPrompt, modify the 'analyse' case:
case 'analyse':
  // If images are present, use compliance-specific prompt
  if (complianceCategories) {
    return buildComplianceSystemPrompt(complianceCategories, contextDocuments);
  }
  // Otherwise, existing text analysis prompt
  return `You are a content reviewer...` // existing prompt unchanged
```

The `complianceCategories` parameter is passed from `ai-service.ts` when images are detected in analyse mode.

## Step 4: Extend AI Config Service

**File**: `backend/src/services/ai/ai-config-service.ts`

Add methods to read/write compliance category configuration:

```typescript
async getComplianceCategories(): Promise<Record<ComplianceCategory, ComplianceCategoryConfig>> {
  const configs = await this.getForScope('compliance');
  const result = { ...COMPLIANCE_DEFAULTS };
  for (const config of configs) {
    if (COMPLIANCE_CATEGORIES.includes(config.key as ComplianceCategory)) {
      result[config.key as ComplianceCategory] = config.value as ComplianceCategoryConfig;
    }
  }
  return result;
}

async updateComplianceCategory(
  category: ComplianceCategory,
  config: ComplianceCategoryConfig,
  updatedBy: string
): Promise<void> {
  await this.update('compliance', category, config, updatedBy);
}
```

## Step 5: Extend AI Service for Compliance Detection

**File**: `backend/src/services/ai/ai-service.ts`

In the `generate()` method, detect compliance mode and pass categories to the provider:

```typescript
// After fetching context documents, before calling provider:
let complianceCategories: Record<ComplianceCategory, ComplianceCategoryConfig> | undefined;

if (input.mode === 'analyse' && input.images?.length) {
  complianceCategories = await aiConfigService.getComplianceCategories();
  const anyEnabled = Object.values(complianceCategories).some(c => c.enabled);
  if (!anyEnabled) {
    throw new AIServiceError('All compliance categories are disabled', 'COMPLIANCE_DISABLED', 400);
  }
  // Audit: compliance-specific event
  await auditLogger.log({
    action: 'compliance.analysis_requested',
    actorId: input.userId,
    actorType: 'user',
    resourceType: 'branch',
    resourceId: input.branchId,
    metadata: {
      imageCount: input.images.length,
      enabledCategories: Object.entries(complianceCategories)
        .filter(([_, c]) => c.enabled)
        .map(([k]) => k),
      providerId: provider.id,
      conversationId,
    },
  });
}

// Pass complianceCategories to provider (only set when compliance mode detected)
```

## Step 6: Extend Admin Routes

**File**: `backend/src/api/routes/ai-config.ts`

Extend the GET and PUT handlers to include compliance configuration:

```typescript
// In GET handler, after fetching existing config:
const complianceCategories = await aiConfigService.getComplianceCategories();
return c.json({ config: { ...existingConfig, compliance: complianceCategories } });

// In PUT handler, process compliance updates:
if (body.compliance) {
  for (const [category, config] of Object.entries(body.compliance)) {
    // Validate category key and config shape
    await aiConfigService.updateComplianceCategory(category, config, user.id);
  }
  // Audit log: compliance.config_changed
}
```

## Step 7: Extend Admin Config Panel

**File**: `frontend/src/components/ai/AIConfigPanel.tsx`

Add a "Compliance Categories" section below existing settings:

```tsx
{/* Compliance Categories Section */}
<Heading size="3">Compliance Categories</Heading>
<Text size="2" color="gray">
  Configure which image compliance categories are checked and their severity levels.
</Text>

{COMPLIANCE_CATEGORIES.map((category) => (
  <Flex key={category} align="center" justify="between" py="2">
    <Text>{COMPLIANCE_CATEGORY_LABELS[category]}</Text>
    <Flex gap="3" align="center">
      <Select value={complianceConfig[category].severity}
              onValueChange={(val) => updateCategorySeverity(category, val)}>
        <Select.Item value="error">Error</Select.Item>
        <Select.Item value="warning">Warning</Select.Item>
        <Select.Item value="informational">Info</Select.Item>
      </Select>
      <Switch checked={complianceConfig[category].enabled}
              onCheckedChange={(val) => updateCategoryEnabled(category, val)} />
    </Flex>
  </Flex>
))}
```

## Step 8: Extend Context Menu for Images

**File**: `frontend/src/components/ai/AIContextMenu.tsx`

When the context menu receives an image URL instead of selected text, show a "Check Compliance" action:

```tsx
// If imageUrl is provided, show compliance action instead of text transforms
if (imageUrl) {
  return (
    <div className="context-menu" style={{ position: 'fixed', left: position.x, top: position.y }}>
      <button onClick={() => onComplianceCheck(imageUrl)}>
        Check Compliance
      </button>
    </div>
  );
}
```

**File**: `frontend/src/components/editor/InlineEditor.tsx`

In the context menu handler, detect right-click on images:

```typescript
const handleContextMenu = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const imgElement = target.closest('img');

  if (imgElement) {
    e.preventDefault();
    // Pass image URL to context menu for compliance check
    setContextMenuImageUrl(imgElement.src);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    return;
  }

  // Existing text selection context menu logic...
};
```

## Testing Strategy

### Unit Tests
- `compliance-prompts.test.ts`: Prompt construction with various category combinations, severity levels, context documents
- `compliance-config.test.ts`: Config resolution with defaults, partial overrides, all-disabled edge case

### Integration Tests
- `compliance-analysis.test.ts`: POST /ai/generate with mode='analyse' + images → compliance-specific response; GET/PUT /ai/config with compliance section

### E2e Tests
- `compliance-analysis.spec.ts`: Context menu on image → compliance check; admin config panel category toggles
