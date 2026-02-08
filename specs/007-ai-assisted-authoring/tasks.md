# Tasks: AI-Assisted Authoring and Controls

**Feature**: `specs/007-ai-assisted-authoring/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-s9p1` |
| **Spec Label** | `spec:007-ai-assisted-authoring` |
| **User Stories Source** | `specs/007-ai-assisted-authoring/spec.md` |
| **Planning Details** | `specs/007-ai-assisted-authoring/plan.md` |
| **Data Model** | `specs/007-ai-assisted-authoring/data-model.md` |

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | AI-Assisted Authoring and Controls |
| **User Stories** | 5 from spec.md (Phase 1: US1+US2, Phase 2: US3+US4+US5) |
| **Priority** | P1 (MVP: Core AI Authoring) → P2 (Review Attribution) → P3-P5 (Admin, Revert, Audit) |
| **Est. Tasks** | 44 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- **Testing as Contract (X)**: Tests written before implementation (TDD)
- **Explicit Change Control (I)**: All AI changes attributable and intentional via `authorType: 'system'` + `initiatingUserId`
- **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- **Clarity Over Breadth (IX)**: Complexity justified in plan.md (3 items)

Refer to `.specify/memory/constitution.md` for full principles.

---

## Status Reference

| Icon | Status | Description |
|------|--------|-------------|
| ⬜ | Pending | Not started |
| 🔄 | In Progress | Work underway |
| ✅ | Completed | Done and verified |
| ⚠️ | Blocked | Waiting on dependency |
| 🎯 | MVP | Core deliverable |

---

## Task Format

```
- [ ] T001 [P] [US1] Description `path/to/file.ext`
```

| Element | Meaning |
|---------|---------|
| `T001` | Task ID (sequential) |
| `[P]` | Parallelizable (different files, no blocking deps) |
| `[US1]` | User Story reference |
| `` `path` `` | Exact file path(s) affected |

---

## Phase 1: Setup — ✅ Completed

**Beads Phase ID**: `echo-portal-qbr4`
**Purpose**: Shared types, database schema, migration — foundational data layer
**Blocks**: All subsequent phases
**Parallelism**: Schema files can run in parallel; migration is sequential after

- [x] T001 [P] Define shared AI types (AIRequestType, AIRequestStatus, AIStreamEvent, AIConversationDetail, AIRequestDetail, AIGenerateParams, AITransformParams, AIStreamChunk) `shared/types/ai.ts`
- [x] T002 [P] Create ai_conversations Drizzle schema with all columns, indexes, and partial unique constraint per data-model.md `backend/src/db/schema/ai-conversations.ts`
- [x] T003 [P] Create ai_requests Drizzle schema with all columns, indexes, and constraints per data-model.md `backend/src/db/schema/ai-requests.ts`
- [x] T004 Export new ai_conversations and ai_requests tables from schema index `backend/src/db/schema/index.ts`
- [x] T005 Create SQL migration for ai_conversations and ai_requests tables with all indexes `backend/src/db/migrations/0005_add_ai_requests.sql`

**Checkpoint**: `npx drizzle-kit push` succeeds; new tables visible in PostgreSQL

---

## Phase 2: Foundational — ✅ Completed

**Beads Phase ID**: `echo-portal-15w5`
**Purpose**: Backend AI infrastructure all user stories depend on — provider abstraction, services, rate limiting
**Blocks**: All user story implementation
**CRITICAL**: No user story work until this phase completes

- [x] T006 [P] Define AIProvider interface, AIStreamChunk, AIGenerateParams, AITransformParams, and AIProviderConfig types `backend/src/services/ai/provider-interface.ts`
- [x] T007 [P] Implement AIProviderRegistry with register, get, getDefault, and listProviders methods `backend/src/services/ai/provider-registry.ts`
- [x] T008 [P] Implement EchoProvider (mock/dev provider) that returns streamed content from prompts for testing `backend/src/services/ai/providers/echo-provider.ts`
- [x] T009 Implement ConversationService with create, getActive, addTurn, end, cleanupExpired, and discardPending methods `backend/src/services/ai/conversation-service.ts`
- [x] T010 [P] Implement AIRateLimiter with checkLimit (count ai_requests in last hour) and getRemainingQuota methods `backend/src/services/ai/rate-limiter.ts`
- [x] T011 Implement core AIService with generate, transform, acceptRequest, rejectRequest, cancelRequest, and discardBySession methods. Orchestrates provider → storage → audit `backend/src/services/ai/ai-service.ts`
- [x] T012 [P] Create aiRateLimit Hono middleware that calls AIRateLimiter and returns 429 with Retry-After header `backend/src/api/middleware/ai-rate-limit.ts`
- [x] T013 Define Zod validation schemas for generate, transform, accept, reject, and cancel request bodies `backend/src/api/schemas/ai-schemas.ts`

**Checkpoint**: AIService can create conversations, stream from EchoProvider, store requests, and enforce rate limits. All via unit tests.

---

## Phase 3: User Story 1 — Core AI Authoring (P1) 🎯 MVP — ✅ Completed

**Beads Phase ID**: `echo-portal-2k0i`
**Goal**: Author can generate content via chat, transform via context menu, accept/reject AI output, and have multi-turn conversations — all within a draft branch
**Acceptance**: Author opens AI panel → submits prompt → sees streaming response → accepts → new version created with authorType='system'. Can also select text → right-click → transform → accept/reject inline.
**Dependencies**: Phase 2 complete

### Backend Routes

- [ ] T014 [US1] Implement POST /api/v1/ai/generate route with SSE streaming via Hono streamSSE(), branch draft state check, permission check, single-pending enforcement, and audit logging `backend/src/api/routes/ai.ts`
- [ ] T015 [US1] Implement POST /api/v1/ai/transform route with SSE streaming, selectedText validation, same authorization as generate `backend/src/api/routes/ai.ts`
- [ ] T016 [US1] Implement POST /api/v1/ai/requests/:requestId/accept route that calls versionService.createVersion() with authorType='system' and logs ai.accepted audit event `backend/src/api/routes/ai.ts`
- [ ] T017 [US1] Implement POST /api/v1/ai/requests/:requestId/reject and POST /requests/:requestId/cancel routes `backend/src/api/routes/ai.ts`
- [ ] T018 [US1] Implement GET /api/v1/ai/conversation and DELETE /conversation/:id routes for conversation retrieval and cleanup `backend/src/api/routes/ai.ts`
- [ ] T019 [US1] Implement GET /api/v1/ai/requests/:requestId route for reload/refresh scenarios `backend/src/api/routes/ai.ts`
- [ ] T020 [US1] Register AI routes in the main Hono app router `backend/src/api/index.ts`

### Frontend Services & State

- [ ] T021 [P] [US1] Create AI API service wrapper with methods for generate, transform, accept, reject, cancel, getConversation, clearConversation, getRequest `frontend/src/services/ai-api.ts`
- [ ] T022 [P] [US1] Implement useSSEStream hook using fetch() + ReadableStream with AbortController, auth headers, SSE event parsing, and reactive state (content, status, error, abort) `frontend/src/hooks/useSSEStream.ts`
- [ ] T023 [P] [US1] Create Zustand aiStore with panel visibility, active conversation, pending request, streaming state, and branch-scoped cleanup `frontend/src/stores/aiStore.ts`
- [ ] T024 [US1] Implement useAIAssist hook that composes useSSEStream + aiStore + ai-api for generate and transform workflows `frontend/src/hooks/useAIAssist.ts`
- [ ] T025 [US1] Implement useAIConversation hook for multi-turn state management, turn counting, and branch-switch cleanup `frontend/src/hooks/useAIConversation.ts`

### Frontend Components

- [ ] T026 [P] [US1] Create AIStreamDisplay component that renders streaming markdown text with cursor indicator `frontend/src/components/ai/AIStreamDisplay.tsx`
- [ ] T027 [P] [US1] Create AIChatMessage component for user prompt bubbles and AI response bubbles with accept/reject/edit actions `frontend/src/components/ai/AIChatMessage.tsx`
- [ ] T028 [US1] Create AIChatPanel — collapsible side panel with conversation history, prompt input, send button, loading states, turn counter, and new conversation action `frontend/src/components/ai/AIChatPanel.tsx`
- [ ] T029 [US1] Create AIContextMenu — right-click context menu on selected text with transform actions (rewrite, summarize, expand, change tone, custom) positioned at selection coordinates `frontend/src/components/ai/AIContextMenu.tsx`
- [ ] T030 [US1] Create AIInlinePreview — inline replacement with visual highlight for pending AI content, floating Accept/Reject toolbar, and original text restoration on reject `frontend/src/components/ai/AIInlinePreview.tsx`

### Editor Integration

- [ ] T031 [US1] Add AI panel toggle button to EditorToolbar `frontend/src/components/editor/EditorToolbar.tsx`
- [ ] T032 [US1] Wire AIContextMenu and AIInlinePreview into InlineEditor — handle contextmenu event on selection, ProseMirror decoration for inline preview, and content replacement on accept. EDGE CASE: If the user modifies the document or changes selection while a transform is streaming, abort the active stream (call cancel endpoint), discard the in-progress result, remove the inline preview decoration, and show a brief toast notification ("Transformation cancelled — text was modified"). Listen for ProseMirror `tr.docChanged` or selection change transactions while `aiStore.streamingStatus === 'streaming'` to detect this. `frontend/src/components/editor/InlineEditor.tsx`
- [ ] T033 [US1] Mount AIChatPanel alongside editor in ContentEditor, wire panel toggle state, ensure useAutoSave skips pending AI content `frontend/src/components/content/ContentEditor.tsx`

**Checkpoint**: Full AI authoring flow works end-to-end: generate via chat, transform via context menu, streaming display, accept creates version with AI attribution, reject discards. Multi-turn conversations work. Rate limits enforced.

---

## Phase 4: User Story 2 — Review Attribution (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-u8nx`
**Goal**: Reviewers see clear visual distinction between AI-generated and human-authored content versions in review interfaces
**Acceptance**: Branch with mixed AI/human versions submitted for review → reviewer sees AI badge on AI-generated versions in DiffView, VersionHistory, and ReviewDetail with model/approver/timestamp details
**Dependencies**: Phase 2 complete (can run parallel with US1 for component work; needs US1 for integration testing)

- [ ] T034 [P] [US2] Create AIAttributionBadge component showing "AI Generated" badge with provider/model tooltip, approver name, and generation timestamp. Uses authorType from ContentVersionDetail `frontend/src/components/ai/AIAttributionBadge.tsx`
- [ ] T035 [US2] Add AIAttributionBadge to DiffView — show badge on diff entries where the version has authorType='system'. Include provider details from audit metadata on hover `frontend/src/components/review/DiffView.tsx`
- [ ] T036 [US2] Add AIAttributionBadge to VersionHistory entries — show badge inline for versions with authorType='system' `frontend/src/components/content/VersionHistory.tsx`
- [ ] T037 [US2] Add AI content summary to ReviewDetail header — count of AI-generated versions in the review, prominent notice when branch contains AI content `frontend/src/components/review/ReviewDetail.tsx`

**Checkpoint**: Reviewer opens review → AI-generated versions show clear attribution badge → hover reveals model/approver details. Version history also shows AI badges.

---

## Phase 5: User Story 3 — Admin AI Configuration (P3) — ⬜ Pending

**Beads Phase ID**: `echo-portal-gqrf`
**Goal**: Administrators can configure AI constraints: global toggle, per-role enable/disable, content type restrictions, usage quotas, approved providers
**Acceptance**: Admin disables AI → all users see AI panel disabled. Admin changes rate limit → new limit enforced.
**Dependencies**: Phase 3 (US1) complete — needs working AI infrastructure to configure

### Backend

- [ ] T038 [P] [US3] Create ai_configurations Drizzle schema per data-model.md `backend/src/db/schema/ai-configurations.ts`
- [ ] T039 [P] [US3] Create SQL migration for ai_configurations table `backend/src/db/migrations/0006_add_ai_config.sql`
- [ ] T040 [US3] Implement AIConfigService with get, update, getForRole, isEnabled, getEffectiveLimits methods `backend/src/services/ai/ai-config-service.ts`
- [ ] T041 [US3] Implement GET /api/v1/ai/config and PUT /api/v1/ai/config routes (admin only) with audit logging `backend/src/api/routes/ai-config.ts`
- [ ] T042 [US3] Update AIService and AIRateLimiter to check AIConfigService for effective limits instead of hardcoded values `backend/src/services/ai/ai-service.ts`, `backend/src/services/ai/rate-limiter.ts`

### Frontend

- [ ] T043 [US3] Create AIConfigPanel admin component with toggles, role config, quota inputs, and provider list `frontend/src/components/ai/AIConfigPanel.tsx`
- [ ] T044 [US3] Update AIChatPanel to check AI enabled state from config and show disabled message when AI is off for user's role `frontend/src/components/ai/AIChatPanel.tsx`

**Checkpoint**: Admin toggles AI off → authors see disabled state. Admin changes limits → new limits apply.

---

## Phase 6: User Story 4 — AI Content Revert (P4) — ⬜ Pending

**Beads Phase ID**: `echo-portal-x9p6`
**Goal**: Authors can independently revert AI-generated content without affecting human-authored changes
**Acceptance**: Author accepts AI content → later selects "Revert AI Content" → AI version reverted, human versions preserved
**Dependencies**: Phase 3 (US1) complete

- [ ] T045 [US4] Implement AI-specific version revert: add POST /api/v1/contents/:contentId/versions/:versionId/revert endpoint (or extend existing revert). Revert restores the content body from the version immediately preceding the target AI version. If human edits exist after the AI version, warn the user that reverting will create a new version with the pre-AI content (human edits on top of AI content are NOT automatically rebased). Log `ai.reverted` audit event with original versionId and new versionId. `backend/src/services/content/version-service.ts`, `backend/src/api/routes/contents.ts`
- [ ] T046 [US4] Update VersionHistory to show "Revert AI Content" action on AI-generated versions (authorType='system'). RevertDialog shows AI-specific messaging: if human edits exist after the AI version, display a warning "Human edits made after this AI version will remain in version history but the current content will revert to the pre-AI state." On confirm, call revert endpoint from T045. On success, refresh version history. `frontend/src/components/content/VersionHistory.tsx`, `frontend/src/components/content/RevertDialog.tsx`

**Checkpoint**: Author reverts AI version → content restored to pre-AI state → audit log shows reversion with attribution.

---

## Phase 7: User Story 5 — AI Audit Reporting (P5) — ⬜ Pending

**Beads Phase ID**: `echo-portal-im0w`
**Goal**: Auditors can query and filter all AI activity across the system
**Acceptance**: Auditor opens AI audit view → filters by time range, user, provider → sees complete AI activity log
**Dependencies**: Phase 3 (US1) complete

- [ ] T047 [US5] Implement GET /api/v1/ai/audit route with filtering by userId, providerId, action, dateRange, and pagination `backend/src/api/routes/ai-config.ts`
- [ ] T048 [US5] Create AIAuditDashboard component with filters (date range, user, provider, action type) and paginated event list `frontend/src/components/ai/AIAuditDashboard.tsx`

**Checkpoint**: Auditor queries AI activity → sees complete record of all AI invocations, acceptances, rejections with full attribution.

---

## Phase 8: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `echo-portal-2adl`
**Purpose**: Quality improvements, edge case coverage, E2E testing, documentation
**Dependencies**: Phase 3 (US1) and Phase 4 (US2) complete minimum

- [ ] T049 [P] Add unit tests for AIProvider interface, EchoProvider, AIService, ConversationService, AIRateLimiter `backend/tests/unit/`
- [ ] T050 [P] Add integration tests for generate→accept flow, transform→reject flow, rate limiting, session cleanup, attribution chain `backend/tests/integration/`
- [ ] T051 [P] Add component tests for AIChatPanel, AIAttributionBadge, AIContextMenu, AIInlinePreview `frontend/tests/unit/`
- [ ] T052 Add E2E test: full authoring flow (generate → accept → review shows attribution) `frontend/tests/e2e/ai-authoring.spec.ts`
- [ ] T053 Run quickstart.md verification checklist end-to-end and document results
- [ ] T054 Code cleanup — remove console.logs, ensure consistent error handling, verify audit event coverage

**Checkpoint**: All tests pass. Full verification checklist green. Feature production-ready.

---

## Dependency Graph

```
Phase 1: Setup (T001-T005)
    │
    ▼
Phase 2: Foundational (T006-T013)
    │
    ├──────────────────────┐
    ▼                      ▼
Phase 3: US1 (P1) 🎯   Phase 4: US2 (P2)
Core AI Authoring       Review Attribution
(T014-T033)             (T034-T037)
    │                      │
    ├──────────┬───────────┘
    │          │
    ▼          ▼
Phase 5: US3  Phase 6: US4  Phase 7: US5
Admin Config  AI Revert     Audit Reporting
(T038-T044)   (T045-T046)   (T047-T048)
    │          │              │
    └──────────┴──────────────┘
               │
               ▼
         Phase 8: Polish (T049-T054)
```

### Key Rules

1. **Setup** → Start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1 + US2** → Can run in parallel after Foundational (US2 component work can parallelize; integration needs US1)
4. **US3, US4, US5** → Require US1 complete (depend on working AI infrastructure)
5. **Polish** → After US1 + US2 minimum

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 (MVP) → STOP & VALIDATE → [US2 → US3 → US4 → US5 → Polish]
```

Ship after US1 if viable. Add review attribution (US2) next.

### Strategy B: Parallel Team

```
All: Setup → Foundational
Then split:
  Dev A: US1 Backend (T014-T020)
  Dev B: US1 Frontend (T021-T033)
  Dev C: US2 (T034-T037, parallel with US1 component work)
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state

---

## Beads ID Mapping

> **Beads tracking is ACTIVE** — All phases and tasks are tracked in beads.

### Epic & Phases

| Phase | Beads ID | Depends On |
|-------|----------|------------|
| **Epic** | `echo-portal-s9p1` | — |
| Phase 1: Setup | `echo-portal-qbr4` | — |
| Phase 2: Foundational | `echo-portal-15w5` | Phase 1 |
| Phase 3: US1 MVP | `echo-portal-2k0i` | Phase 2 |
| Phase 4: US2 | `echo-portal-u8nx` | Phase 2 |
| Phase 5: US3 | `echo-portal-gqrf` | Phase 3 |
| Phase 6: US4 | `echo-portal-x9p6` | Phase 3 |
| Phase 7: US5 | `echo-portal-im0w` | Phase 3 |
| Phase 8: Polish | `echo-portal-2adl` | Phase 3, Phase 4 |

### Tasks

| Task | Beads ID | Phase |
|------|----------|-------|
| T001 | `echo-portal-qbr4.1` | Setup |
| T002 | `echo-portal-qbr4.2` | Setup |
| T003 | `echo-portal-qbr4.3` | Setup |
| T004 | `echo-portal-qbr4.4` | Setup |
| T005 | `echo-portal-qbr4.5` | Setup |
| T006 | `echo-portal-15w5.1` | Foundational |
| T007 | `echo-portal-15w5.2` | Foundational |
| T008 | `echo-portal-15w5.3` | Foundational |
| T009 | `echo-portal-15w5.4` | Foundational |
| T010 | `echo-portal-15w5.5` | Foundational |
| T011 | `echo-portal-15w5.6` | Foundational |
| T012 | `echo-portal-15w5.7` | Foundational |
| T013 | `echo-portal-15w5.8` | Foundational |
| T014 | `echo-portal-mue9` | US1 MVP |
| T015 | `echo-portal-r0jc` | US1 MVP |
| T016 | `echo-portal-p6hn` | US1 MVP |
| T017 | `echo-portal-qz8r` | US1 MVP |
| T018 | `echo-portal-rohv` | US1 MVP |
| T019 | `echo-portal-z4k1` | US1 MVP |
| T020 | `echo-portal-h0nt` | US1 MVP |
| T021 | `echo-portal-s468` | US1 MVP |
| T022 | `echo-portal-93wu` | US1 MVP |
| T023 | `echo-portal-zijp` | US1 MVP |
| T024 | `echo-portal-4zzm` | US1 MVP |
| T025 | `echo-portal-qekl` | US1 MVP |
| T026 | `echo-portal-7kx1` | US1 MVP |
| T027 | `echo-portal-y3t2` | US1 MVP |
| T028 | `echo-portal-s20e` | US1 MVP |
| T029 | `echo-portal-bj6m` | US1 MVP |
| T030 | `echo-portal-yyh7` | US1 MVP |
| T031 | `echo-portal-of5m` | US1 MVP |
| T032 | `echo-portal-kuqb` | US1 MVP |
| T033 | `echo-portal-fs0z` | US1 MVP |
| T034 | `echo-portal-puc1` | US2 |
| T035 | `echo-portal-xlum` | US2 |
| T036 | `echo-portal-tk76` | US2 |
| T037 | `echo-portal-ztay` | US2 |
| T038 | `echo-portal-85gy` | US3 |
| T039 | `echo-portal-bqy8` | US3 |
| T040 | `echo-portal-d591` | US3 |
| T041 | `echo-portal-v13p` | US3 |
| T042 | `echo-portal-ix77` | US3 |
| T043 | `echo-portal-o8bz` | US3 |
| T044 | `echo-portal-ft6c` | US3 |
| T045 | `echo-portal-47pd` | US4 |
| T046 | `echo-portal-0075` | US4 |
| T047 | `echo-portal-rsvs` | US5 |
| T048 | `echo-portal-e9kc` | US5 |
| T049 | `echo-portal-b7hh` | Polish |
| T050 | `echo-portal-scsf` | Polish |
| T051 | `echo-portal-7i3z` | Polish |
| T052 | `echo-portal-p1i7` | Polish |
| T053 | `echo-portal-g9kb` | Polish |
| T054 | `echo-portal-6eny` | Polish |
