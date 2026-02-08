# Implementation Plan: AI-Assisted Authoring and Controls

**Branch**: `007-ai-assisted-authoring` | **Date**: 2026-02-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-ai-assisted-authoring/spec.md`

## Summary

Enable AI-assisted content authoring within the branch-first collaboration model. Authors get two AI interaction surfaces — a side-panel chat for generation/multi-turn refinement and an inline context menu for selection-based transforms — with real-time SSE streaming, server-side ephemeral request storage, and version-level attribution that flows through review, approval, and audit. Phase 1 delivers core authoring + review attribution; Phase 2 adds admin constraints, AI-specific revert, and audit reporting.

## Technical Context

**Language/Version**: TypeScript 5.9+, Node.js 20 LTS
**Primary Dependencies**: Hono 4.8.2 (backend), React 19 + Zustand + TanStack Query 5 (frontend), Milkdown (editor), Drizzle ORM 0.44 (PostgreSQL), XState 5.19.2, Zod 3.24.2
**Storage**: PostgreSQL (existing schema + new `ai_requests`, `ai_conversations`, `ai_configurations` tables)
**Testing**: Vitest (unit/component), Playwright (e2e)
**Target Platform**: Web (Node.js server + browser SPA)
**Project Type**: Web application (backend + frontend + shared)
**Performance Goals**: AI response streaming with <500ms time-to-first-token perceived latency; SSE delivery at provider speed; attribution queries <200ms
**Constraints**: Max ~4,000 tokens per generation, 20 conversation turns per session, 50 requests/user/hour (Phase 1 hardcoded); no direct state transitions by AI; branch-only content creation
**Scale/Scope**: Multi-user system; AI requests are ephemeral (session-scoped TTL); conversation context stored server-side

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with Echo Portal Constitution (v1.0.1):

- [x] **Explicit Change Control (I)**: All AI changes are explicit (user-initiated request → AI generates → user explicitly accepts). No implicit mutation. AI content creates new versions with full attribution. Pending content requires explicit acceptance.
- [x] **Single Source of Truth (II)**: AI never touches published state. All AI content is created within branches. Accepted content becomes a standard version in the draft lifecycle.
- [x] **Branch-First Collaboration (III)**: FR-001 ensures all AI content is branch-scoped. FR-009 enforces branch lifecycle rules. AI content follows Draft → Review → Approved → Published.
- [x] **Separation of Concerns (IV)**: AI assistance requires authentication (no anonymous access). AI panel is a contribution-mode feature. Review attribution (P2) is read-only.
- [x] **Role-Driven Governance (V)**: Actors table defines permissions per role. AI System actor cannot initiate transitions (FR-007). All AI actions attributable via `authorType: 'system'` + `initiatingUserId`.
- [x] **Open by Default (VI)**: Published content visibility unchanged. AI panel is authenticated-only. Pending AI content is private to requesting author.
- [x] **Layered Architecture (VII)**: AI provider interface is a new outer-layer service. Core workflows (branching, review, publish) remain unchanged. AI integrates via existing `versionService.createVersion()` and audit infrastructure.
- [x] **Specification Completeness (VIII)**: Spec has all mandatory sections: actors/permissions, lifecycle states, visibility boundaries, auditability, success criteria.
- [x] **Clarity Over Breadth (IX)**: Single-pending-request constraint keeps UX simple. Version-level attribution avoids span-tracking complexity. Hardcoded limits in Phase 1 defer configuration UI.
- [x] **Testing as Contract (X)**: 80% core workflow coverage required. All acceptance scenarios are testable Given/When/Then. Edge cases documented with resolutions.

## Project Structure

### Documentation (this feature)

```text
specs/007-ai-assisted-authoring/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/schema/
│   │   ├── ai-requests.ts           # NEW: ai_requests table (ephemeral)
│   │   ├── ai-conversations.ts      # NEW: ai_conversations table
│   │   ├── ai-configurations.ts     # NEW: ai_configurations table (Phase 2)
│   │   └── index.ts                 # MODIFIED: export new tables
│   ├── services/
│   │   └── ai/
│   │       ├── provider-interface.ts # NEW: AIProvider abstract interface
│   │       ├── provider-registry.ts  # NEW: provider registry + factory
│   │       ├── providers/
│   │       │   └── echo-provider.ts  # NEW: default/mock provider implementation
│   │       ├── ai-service.ts         # NEW: core AI orchestration service
│   │       ├── conversation-service.ts # NEW: conversation management
│   │       ├── rate-limiter.ts       # NEW: per-user rate limiting
│   │       └── ai-config-service.ts  # NEW: admin config (Phase 2)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── ai.ts                # NEW: AI assistance routes (generate, transform, accept, reject, cancel)
│   │   │   └── ai-config.ts         # NEW: admin AI config routes (Phase 2)
│   │   └── middleware/
│   │       └── ai-rate-limit.ts     # NEW: rate limiting middleware
│   └── db/migrations/
│       ├── 0005_add_ai_requests.sql  # NEW: ai_requests + ai_conversations tables
│       └── 0006_add_ai_config.sql    # NEW: ai_configurations table (Phase 2)
└── tests/
    ├── unit/
    │   ├── ai-service.test.ts
    │   ├── provider-interface.test.ts
    │   ├── conversation-service.test.ts
    │   └── rate-limiter.test.ts
    └── integration/
        ├── ai-generate.test.ts
        ├── ai-transform.test.ts
        ├── ai-accept-reject.test.ts
        └── ai-attribution.test.ts

frontend/
├── src/
│   ├── components/
│   │   └── ai/
│   │       ├── AIChatPanel.tsx       # NEW: side panel chat interface
│   │       ├── AIChatMessage.tsx     # NEW: message bubble component
│   │       ├── AIContextMenu.tsx     # NEW: right-click transform menu
│   │       ├── AIInlinePreview.tsx   # NEW: inline replacement with toolbar
│   │       ├── AIAttributionBadge.tsx # NEW: "AI Generated" badge
│   │       └── AIStreamDisplay.tsx   # NEW: streaming text renderer
│   ├── hooks/
│   │   ├── useAIAssist.ts           # NEW: generation/transform requests
│   │   ├── useAIConversation.ts     # NEW: multi-turn conversation state
│   │   └── useSSEStream.ts          # NEW: SSE streaming hook
│   ├── services/
│   │   └── ai-api.ts               # NEW: AI endpoint wrapper
│   └── stores/
│       └── aiStore.ts              # NEW: Zustand store for AI panel state
└── tests/
    ├── unit/
    │   ├── AIChatPanel.test.tsx
    │   └── AIAttributionBadge.test.tsx
    └── e2e/
        └── ai-authoring.spec.ts

shared/
└── types/
    └── ai.ts                        # NEW: AI request/response types
```

**Structure Decision**: Web application pattern (backend + frontend + shared). New AI modules are self-contained under `services/ai/` (backend) and `components/ai/` (frontend), following the existing feature-module pattern. Integration with existing infrastructure via well-defined service boundaries (`versionService`, `auditLogger`, permission middleware).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Pluggable provider interface | Spec FR-011 requires provider-agnostic behavior; admin config (P3) requires provider selection | Single hardcoded provider would require rewrite for Phase 2 |
| SSE streaming endpoint | Spec FR-019 requires real-time token streaming; no existing SSE pattern | Polling would add latency and complexity; batch response has poor UX for long generations |
| Server-side ephemeral storage | Spec FR-018 requires persistence across page refresh + discard on session end | Client-only storage can't support audit of rejected content (FR-005) |

## Post-Design Constitution Re-Check

All 10 principles verified after Phase 1 design:

- [x] **(I) Explicit Change Control**: AI content acceptance is a deliberate user action that creates a new content version. No auto-save of AI content. Pending content is never part of the draft until explicitly accepted.
- [x] **(II) Single Source of Truth**: AI content only enters the version history via `versionService.createVersion()`. Published content untouched.
- [x] **(III) Branch-First**: All AI routes validate branch is in 'draft' state. Authorization checks use existing `checkBranchEditContextual` middleware.
- [x] **(IV) Separation of Concerns**: AI endpoints are write-only (authenticated). Attribution badges in review are read-only. API routes clearly categorized.
- [x] **(V) Role-Driven Governance**: AI system actor uses existing `actorTypeEnum: 'system'`. `initiatingUserId` links every AI action to the human. Audit log format unchanged.
- [x] **(VI) Open by Default**: No visibility changes. Pending content is private to author. Accepted content follows branch visibility.
- [x] **(VII) Layered Architecture**: AI service is an outer-layer module. Core contracts (`versionService`, `auditLogger`, permission middleware) remain unchanged. No modifications to branch state machine or review workflow.
- [x] **(VIII) Specification Completeness**: All mandatory sections present. Data model, contracts, and research artifacts generated.
- [x] **(IX) Clarity Over Breadth**: Three complexity items justified above. All other design choices favor simplicity (version-level attribution, single pending request, hardcoded limits).
- [x] **(X) Testing as Contract**: Test strategy covers unit, integration, component, and e2e. Verification checklist in quickstart.md maps to all acceptance scenarios.
