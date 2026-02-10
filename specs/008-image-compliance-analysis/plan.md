# Implementation Plan: AI-Powered Image Compliance Analysis

**Branch**: `008-image-compliance-analysis` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-image-compliance-analysis/spec.md`

## Summary

Extend the existing `/analyse` mode from 007-ai-assisted-authoring to perform image compliance analysis when images are attached. When a user sends images with `/analyse`, the system detects the multimodal input and switches to compliance-specific system prompts structured around five administrator-configured categories: brand adherence, accessibility, content appropriateness, licensing and attribution, and technical quality. Category configuration is stored in the existing `ai_configurations` table using the established scope/key pattern. The editor's AI context menu is extended with a "Check Compliance" action for images. No new database tables, conversation types, or interaction surfaces are introduced.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Milkdown (editor), Drizzle ORM 0.44 (PostgreSQL), Zod 3.24.2
**Storage**: PostgreSQL (existing `ai_configurations` table — no new tables)
**Testing**: Vitest (unit + integration), Playwright (e2e)
**Target Platform**: Web application (pnpm monorepo: backend/, frontend/, shared/)
**Performance Goals**: <15s for single-image compliance analysis (SC-001)
**Constraints**: Reuse 007 infrastructure without modification to existing provider, streaming, or conversation systems
**Scale/Scope**: Same user base as 007; compliance adds ~5 config rows per deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All compliance analysis is user-initiated via `/analyse` command. No automatic or background image scanning. All activity audited with `compliance.*` action prefix.
- [x] **Single Source of Truth (II)**: Compliance analysis is advisory only — no published content is modified. Findings live in ephemeral AI conversations, never altering branch or published state.
- [x] **Branch-First Collaboration (III)**: Compliance checks operate within branch context. Users must be editing a draft branch or reviewing a branch in review state. No interaction with published main.
- [x] **Separation of Concerns (IV)**: Compliance analysis is a contribution-mode activity (requires authentication). No compliance data is exposed through consumption/read paths. Configuration is admin-only.
- [x] **Role-Driven Governance (V)**: Three actor levels defined: contributor (check own drafts), reviewer (check reviewed branches), administrator (configure categories). All actions attributable via audit trail.
- [x] **Open by Default (VI)**: No new restrictions introduced. Compliance findings are private to the conversation initiator. Published content remains publicly readable and unaffected.
- [x] **Layered Architecture (VII)**: Core 007 systems (provider registry, streaming, conversations, audit) are reused without modification. Changes are limited to system prompt construction and configuration extension.
- [x] **Specification Completeness (VIII)**: Spec includes actors/permissions, lifecycle states, visibility boundaries, auditability, success criteria, and verification requirements. All mandatory sections present.
- [x] **Clarity Over Breadth (IX)**: Feature deliberately scoped to chat-based advisory feedback. No persistent reports, no publish gate, no reviewer workflow extensions. Simplest effective implementation.
- [x] **Testing as Contract (X)**: 80% core workflow coverage target. Unit tests for prompt construction and config resolution. Integration tests for API endpoints. E2e tests for context menu and chat panel workflows.

## Project Structure

### Documentation (this feature)

```text
specs/008-image-compliance-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── compliance-api.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       └── ai-config.ts                    # MODIFY: add compliance category endpoints
│   ├── services/
│   │   └── ai/
│   │       ├── ai-config-service.ts            # MODIFY: add compliance config helpers
│   │       ├── ai-service.ts                   # MODIFY: detect images + analyse mode → compliance prompts
│   │       ├── compliance-prompts.ts           # NEW: compliance-specific system prompt builder
│   │       └── providers/
│   │           ├── anthropic-provider.ts        # MODIFY: delegate to compliance prompt when applicable
│   │           └── openai-provider.ts           # MODIFY: delegate to compliance prompt when applicable
│   └── api/
│       └── schemas/
│           └── ai-schemas.ts                   # MODIFY: add compliance config validation schemas
└── tests/
    ├── unit/
    │   ├── compliance-prompts.test.ts          # NEW: prompt construction tests
    │   └── compliance-config.test.ts           # NEW: config resolution tests
    └── integration/
        └── compliance-analysis.test.ts         # NEW: API endpoint integration tests

frontend/
├── src/
│   ├── components/
│   │   ├── ai/
│   │   │   ├── AIChatPanel.tsx                 # MODIFY: compliance-aware auto-dismiss (unchanged — analyse mode already auto-dismisses)
│   │   │   ├── AIConfigPanel.tsx               # MODIFY: add compliance category configuration section
│   │   │   └── AIContextMenu.tsx               # MODIFY: add "Check Compliance" action for images
│   │   └── editor/
│   │       └── InlineEditor.tsx                # MODIFY: detect right-click on images, pass image to context menu
│   └── services/
│       └── ai-api.ts                           # MODIFY: add compliance config API methods
└── tests/
    ├── unit/
    │   └── components/
    │       ├── ComplianceConfig.test.tsx        # NEW: config panel tests
    │       └── AIContextMenu.test.tsx           # MODIFY: add compliance action tests
    └── e2e/
        └── compliance-analysis.spec.ts         # NEW: e2e smoke tests

shared/
└── types/
    └── ai.ts                                   # MODIFY: add compliance category types
```

**Structure Decision**: Existing pnpm monorepo structure (backend/frontend/shared) with no new directories. New code is limited to one new file (`compliance-prompts.ts`) and modifications to existing files. This follows 007's established patterns.

## Complexity Tracking

No constitution violations. Feature scope is intentionally minimal — extending an existing mode rather than introducing new systems.

## Implementation Phases

### Phase 1: Compliance Prompt Engine + Config Storage (Backend Core)
- Compliance-specific system prompt builder (`compliance-prompts.ts`)
- Image detection in `/analyse` mode flow (modify `getGenerateSystemPrompt` in providers)
- Compliance category config helpers in `ai-config-service.ts`
- Compliance config API endpoints in `ai-config.ts`
- Shared types for compliance categories
- Unit tests for prompt construction and config resolution

### Phase 2: Admin Configuration UI (Frontend)
- Compliance category section in `AIConfigPanel.tsx`
- Per-category enable/disable toggles and severity selectors
- API integration for saving/loading compliance config
- Component tests

### Phase 3: Context Menu Extension (Frontend + Integration)
- "Check Compliance" action in `AIContextMenu.tsx` for image elements
- Image detection on right-click in `InlineEditor.tsx`
- Integration tests for full compliance flow (image → analyse → structured findings)
- E2e smoke tests

### Phase 4: Audit Logging + Polish
- `compliance.*` audit events in AI service
- Edge case handling (all categories disabled, no context docs, provider errors)
- Final test coverage verification

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI provider returns unstructured findings despite compliance prompt | Test prompt with multiple providers; include explicit JSON-like structure instruction in system prompt; accept graceful degradation to freeform analysis |
| Admin misconfigures all categories as disabled | FR-015: system informs user compliance is unavailable; edge case test coverage |
| Large images exceed provider token limits | Existing 007 constraints apply (5MB max, 4 images max); no additional risk |
| Compliance prompt conflicts with context documents | Compliance prompt instructions take priority; context documents are injected as reference material below the main instruction |

## Dependencies

### Existing (from 007)
- AI provider registry and multimodal support
- AI chat panel and conversation infrastructure
- Context document system
- AI configuration service and admin routes
- Audit logging infrastructure
- Rate limiting and turn counting
- SSE streaming

### External
- Anthropic Claude API (multimodal image analysis)
- OpenAI GPT-4o API (multimodal image analysis)

## Success Metrics Mapping

| Success Criterion | Implementation |
|-------------------|----------------|
| SC-001: <15s single image | Reuses existing streaming; no additional latency beyond prompt construction |
| SC-002: Remediation suggestions | Enforced in compliance system prompt ("For each finding, include a specific remediation suggestion") |
| SC-003: Follow-up in context | Inherited from 007 multi-turn conversation; compliance findings in conversation history |
| SC-004: Config without restart | AI config service reads from DB per-request; no caching that requires restart |
| SC-005: Audit trail | `compliance.*` events logged via existing AuditLogger |

## Artifacts Generated

- [x] `plan.md` — This file
- [x] `research.md` — Phase 0 research findings
- [x] `data-model.md` — Entity and configuration model
- [x] `contracts/compliance-api.md` — API endpoint specifications
- [x] `quickstart.md` — Implementation walkthrough
- [x] `tasks.md` — Generated via `/speckit.tasks`
