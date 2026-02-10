# Research: AI-Powered Image Compliance Analysis

**Feature**: 008-image-compliance-analysis
**Date**: 2026-02-10

## Research Areas

### 1. How to detect image input in `/analyse` mode and switch to compliance prompts

**Decision**: Detect at the provider level. When `mode === 'analyse'` AND `params.images?.length > 0`, delegate to the compliance prompt builder instead of the generic analysis prompt.

**Rationale**: The detection point must be in `getGenerateSystemPrompt()` within each provider (anthropic-provider.ts, openai-provider.ts), because that's where mode-specific system prompts are already resolved. Adding an image check to the existing `switch (mode)` block under the `'analyse'` case is the minimal change. The AI service layer (`ai-service.ts`) already passes images through to providers unchanged.

**Alternatives considered**:
- Add a new mode `'compliance'` to `AIResponseMode`: Rejected — the spec explicitly states `/analyse` handles both text and image analysis. A new mode would require frontend changes to parseSlashCommand and break the unified `/analyse` concept.
- Detect in `ai-service.ts` and set a flag: Rejected — adds unnecessary indirection. The provider already has all the information it needs (mode + images).
- Detect in the frontend and send a different mode: Rejected — the frontend shouldn't need to know about compliance prompts. The backend decides prompt strategy.

### 2. Compliance system prompt structure

**Decision**: Build a dedicated prompt builder function (`buildComplianceSystemPrompt`) that constructs a structured system prompt instructing the AI to evaluate each image against enabled compliance categories at their configured severity levels, and return findings in a consistent format.

**Rationale**: The compliance prompt needs to be significantly different from the generic analysis prompt. It must:
- Enumerate enabled categories explicitly
- Specify severity levels per category
- Request structured output (category, severity, description, remediation per finding)
- Incorporate context documents as reference standards
- Handle multi-image attribution

A separate function (not inline in the provider switch) keeps the provider code clean and makes the prompt independently testable.

**Prompt structure**:
```
You are an image compliance reviewer for a documentation portal. Analyse the provided image(s) against the following compliance categories:

[For each enabled category]:
- **{Category Name}** (Severity: {error|warning|informational}): {Category description}

For each issue found, provide:
- **Category**: The compliance category
- **Severity**: {configured severity for that category}
- **Issue**: Clear description of the compliance concern
- **Remediation**: Specific action the author can take to resolve the issue

If the image passes all categories, confirm compliance.

[Reference Materials block from context documents]
```

**Alternatives considered**:
- Unstructured "check this image for compliance" prompt: Rejected — produces inconsistent output format across providers and turns. Structured prompts yield more reliable, parseable findings.
- JSON output format: Rejected — while parseable, it's unfriendly in a chat conversation. Markdown-structured findings are readable in the chat panel without custom rendering.

### 3. Compliance category configuration storage

**Decision**: Use the existing `ai_configurations` table with scope `'compliance'` and keys for each category. Each key stores a JSON value `{ enabled: boolean, severity: 'error' | 'warning' | 'informational' }`.

**Rationale**: The `ai_configurations` table already supports arbitrary scope/key/value patterns. Adding compliance config as scope `'compliance'` with keys like `'brand_adherence'`, `'accessibility'`, etc. requires zero schema changes. The `ai-config-service.ts` already has `get()`, `update()`, and `getForScope()` methods that work directly.

**Config keys**:
- `compliance:brand_adherence` → `{ enabled: true, severity: 'warning' }`
- `compliance:accessibility` → `{ enabled: true, severity: 'warning' }`
- `compliance:content_appropriateness` → `{ enabled: true, severity: 'warning' }`
- `compliance:licensing_attribution` → `{ enabled: true, severity: 'warning' }`
- `compliance:technical_quality` → `{ enabled: true, severity: 'warning' }`

**Alternatives considered**:
- New `compliance_categories` table: Rejected — overkill for 5 static categories. The config table is designed for exactly this kind of key-value settings.
- Hardcoded in environment variables: Rejected — must be configurable by administrators at runtime without deployment.
- Store in a single JSON blob: Rejected — per-category keys allow finer-grained updates and conflict-free concurrent admin edits.

### 4. Admin configuration UI approach

**Decision**: Extend the existing `AIConfigPanel.tsx` with a new "Compliance Categories" section below the existing global/role settings. Each category gets a row with a toggle (enabled/disabled) and a severity dropdown (error/warning/informational).

**Rationale**: The admin already uses `AIConfigPanel` for AI settings. Adding compliance configuration in the same panel maintains a single admin surface. The existing save/fetch pattern (PUT/GET `/ai/config`) can be extended to include compliance scope.

**Alternatives considered**:
- Separate compliance admin page: Rejected — overcomplicates navigation for 5 toggles.
- Inline config in AI chat panel: Rejected — configuration is an admin concern, not an authoring concern.

### 5. Context menu extension for images

**Decision**: Extend `AIContextMenu.tsx` to accept an optional `imageUrl` prop. When `imageUrl` is provided (right-click on an image), show a "Check Compliance" action instead of the text transformation actions. The action extracts the image, converts it to base64, and sends it to the AI chat panel as an `/analyse` request with the image attached.

**Rationale**: The existing context menu already appears on right-click in the editor. Extending it to handle images follows the same interaction pattern. The image-to-base64 conversion can reuse the existing `processImageFile` pattern from `AIChatPanel.tsx`.

**Implementation detail**: In `InlineEditor.tsx`, the `handleContextMenu` event handler needs to check if the right-clicked element is an `<img>` element (or within one). If so, capture the image URL and pass it to the context menu component as `imageUrl` instead of `selectedText`.

**Alternatives considered**:
- Separate compliance-specific context menu component: Rejected — adds component proliferation for a single action.
- Toolbar button on image selection: Rejected — images don't have a "selection" concept like text does.

### 6. Audit logging approach

**Decision**: Add audit events in `ai-service.ts` at the point where compliance analysis is detected (images + analyse mode). Use action prefix `compliance.analysis_requested` with metadata including image count and enabled categories. Config changes logged as `compliance.config_changed` in the admin route handler.

**Rationale**: The existing audit logger in `ai-service.ts` already logs `ai.requested` and `ai.generated` events. Adding compliance-specific events at the same points ensures consistency. Using the `compliance.*` prefix (per spec) makes audit queries filterable.

**Alternatives considered**:
- Rely on existing `ai.requested` events: Rejected — compliance queries need to be distinguished from regular AI interactions. The `compliance.*` prefix enables this.
- Separate compliance audit service: Rejected — the existing AuditLogger handles all event types; no new service needed.

## Unknowns Resolved

All Technical Context items resolved. No NEEDS CLARIFICATION markers remain.

- **Storage**: Confirmed — existing `ai_configurations` table, no new tables
- **Provider compatibility**: Confirmed — both Anthropic and OpenAI providers already handle multimodal image input in the analyse mode path
- **Frontend changes**: Confirmed — minimal modifications to existing components, one behaviour change in context menu
- **Performance**: No additional latency concerns — compliance prompt construction is string concatenation; AI provider response time dominates
