# Tasks: AI-Powered Image Compliance Analysis

**Feature**: `specs/008-image-compliance-analysis/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/compliance-api.md
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-kg2p` |
| **Spec Label** | `spec:008-image-compliance-analysis` |
| **User Stories Source** | `specs/008-image-compliance-analysis/spec.md` |
| **Planning Details** | `specs/008-image-compliance-analysis/plan.md` |
| **Data Model** | `specs/008-image-compliance-analysis/data-model.md` |

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | AI-Powered Image Compliance Analysis |
| **User Stories** | 4 from spec.md |
| **Priority** | P1 (US1, US2 — MVP) → P2 (US3, US4) |
| **Est. Tasks** | 21 |

### User Story Mapping

| Story | Priority | Description | Phase |
|-------|----------|-------------|-------|
| US1 | P1 | Author checks images for compliance via AI chat | Phase 3 |
| US2 | P1 | Reviewer checks images during review via AI chat | Phase 3 (shared with US1) |
| US3 | P2 | Administrator configures compliance categories | Phase 4 |
| US4 | P2 | Author checks single image quickly via context menu | Phase 5 |

> **Note**: US1 and US2 share the same backend implementation. US2 requires no additional code beyond US1 — the reviewer role already has AI chat access via 007. US2 is verified through integration tests that confirm reviewer-role access.

### Plan ↔ Tasks Phase Cross-Reference

| plan.md Phase | tasks.md Phase(s) | Notes |
|---------------|-------------------|-------|
| Phase 1: Compliance Prompt Engine + Config Storage | Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1/US2 Tests) | Plan bundles all backend core into one phase; tasks splits into types, infra, and tests |
| Phase 2: Admin Configuration UI | Phase 4 (US3) | 1:1 mapping |
| Phase 3: Context Menu Extension | Phase 5 (US4) | 1:1 mapping |
| Phase 4: Audit Logging + Polish | Phase 6 (Polish) | Audit event implementation moved to Phase 2 (T007, T008); Phase 6 covers audit tests only |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- ✅ **Testing as Contract (X)**: Tests included for each user story
- ✅ **Explicit Change Control (I)**: All compliance activity audited with `compliance.*` prefix
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Minimal extension of 007 — no new systems

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
- [x] T001 [P] [US1] Description `path/to/file.ext`
```

| Element | Meaning |
|---------|---------|
| `T001` | Task ID (sequential) |
| `[P]` | Parallelizable (different files, no blocking deps) |
| `[US1]` | User Story reference |
| `` `path` `` | Exact file path(s) affected |

---

## Phase 1: Setup — ✅ Completed

**Beads Phase ID**: `echo-portal-804i`
**Purpose**: Shared types and compliance prompt builder — foundation for all subsequent work
**Blocks**: All subsequent phases
**Parallelism**: Both tasks touch different files

- [x] T001 [P] Add compliance category shared types (COMPLIANCE_CATEGORIES, ComplianceCategory, ComplianceSeverity, ComplianceCategoryConfig, COMPLIANCE_DEFAULTS, COMPLIANCE_CATEGORY_LABELS, COMPLIANCE_CATEGORY_DESCRIPTIONS) to `shared/types/ai.ts`
- [x] T002 [P] Create compliance-specific system prompt builder with `buildComplianceSystemPrompt()` function that constructs structured prompts from enabled categories, severity levels, and context documents in `backend/src/services/ai/compliance-prompts.ts`

**✓ Checkpoint**: Shared types importable from both backend and frontend; prompt builder returns structured compliance system prompt string

---

## Phase 2: Foundational — Backend Infrastructure — ✅ Completed

**Beads Phase ID**: `echo-portal-fpqj`
**Purpose**: Backend plumbing that ALL user stories depend on — config service, providers, AI service, admin routes
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T003 [P] Add Zod validation schemas for compliance config (ComplianceCategoryConfigSchema, ComplianceCategoryKeySchema) to `backend/src/api/schemas/ai-schemas.ts`
- [x] T004 [P] Add `getComplianceCategories()` and `updateComplianceCategory()` methods to `backend/src/services/ai/ai-config-service.ts`
- [x] T005 [P] Modify `getGenerateSystemPrompt()` analyse case to delegate to `buildComplianceSystemPrompt()` when `complianceCategories` parameter is provided in `backend/src/services/ai/providers/anthropic-provider.ts`
- [x] T006 [P] Modify `getGenerateSystemPrompt()` analyse case to delegate to `buildComplianceSystemPrompt()` when `complianceCategories` parameter is provided in `backend/src/services/ai/providers/openai-provider.ts`
- [x] T007 Extend `generate()` method to detect `mode === 'analyse'` with images, fetch compliance categories, validate at least one enabled, pass to provider, and log `compliance.analysis_requested` audit event in `backend/src/services/ai/ai-service.ts`
- [x] T008 Extend GET and PUT handlers to include compliance category configuration (read, validate, update) and log `compliance.config_changed` audit event in PUT handler in `backend/src/api/routes/ai-config.ts`

**✓ Checkpoint**: Backend serves compliance-specific prompts when images + analyse mode are detected; admin config endpoints accept compliance settings

---

## Phase 3: US1/US2 — Author & Reviewer Image Compliance Analysis (P1) 🎯 MVP — ✅ Completed

**Beads Phase ID**: `echo-portal-x2ii`
**Goal**: Authors and reviewers can upload images with `/analyse` and receive structured compliance findings
**Acceptance**: Author opens AI chat, uploads image, triggers `/analyse`, receives findings with category/severity/description/remediation. Reviewer does the same on a branch in review state.
**Dependencies**: Phase 2 complete

### Tests

- [x] T009 [P] [US1] Unit tests for `buildComplianceSystemPrompt()`: all categories enabled, partial categories, severity levels, context documents, empty categories edge case in `backend/tests/unit/compliance-prompts.test.ts`
- [x] T010 [P] [US1] Unit tests for compliance config resolution: defaults when no DB config, partial overrides, all-disabled edge case in `backend/tests/unit/compliance-config.test.ts`
- [x] T011 [US1] Integration tests for POST `/api/v1/ai/generate` with `mode='analyse'` + images (compliance response), GET/PUT `/api/v1/ai/config` with compliance section, COMPLIANCE_DISABLED error case, and reviewer-role access verification (US2) in `backend/tests/integration/compliance-analysis.test.ts`

**✓ Checkpoint**: All backend compliance paths tested — prompt construction, config resolution, API endpoints, role access

---

## Phase 4: US3 — Administrator Configures Compliance Categories (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-xe9s`
**Goal**: Administrators can enable/disable categories and set severity levels through the existing AI config panel
**Acceptance**: Admin toggles a category off → subsequent compliance checks skip that category; admin changes severity → findings reflect new severity
**Dependencies**: Phase 2 complete (can run parallel with Phase 3)

### Tests — Write FIRST (Constitution X)

- [x] T012 [P] [US3] Component tests for compliance config section: renders categories, toggle enable/disable, change severity, save persists in `frontend/tests/unit/components/ComplianceConfig.test.tsx`

### Implementation

- [x] T013 [P] [US3] Add `getComplianceConfig()` and `updateComplianceConfig()` methods to frontend AI API service in `frontend/src/services/ai-api.ts`
- [x] T014 [US3] Add "Compliance Categories" section to admin config panel with per-category enable/disable Switch and severity Select dropdown in `frontend/src/components/ai/AIConfigPanel.tsx`

**✓ Checkpoint**: Admin can view and modify compliance category configuration through UI

---

## Phase 5: US4 — Context Menu Quick Image Check (P2) — ✅ Completed

**Beads Phase ID**: `echo-portal-72yr`
**Goal**: Authors can right-click an image in the editor and trigger a compliance check directly
**Acceptance**: Right-click image → "Check Compliance" menu item → findings appear in AI chat panel
**Dependencies**: Phase 2 complete (can run parallel with Phase 3, Phase 4)

### Tests — Write FIRST (Constitution X)

- [x] T015 [P] [US4] Component tests for context menu: renders "Check Compliance" when imageUrl provided, does not render text actions for images, triggers compliance check on click in `frontend/tests/unit/components/AIContextMenu.test.tsx`

### Implementation

- [x] T016 [P] [US4] Add `imageUrl` prop support and "Check Compliance" action to context menu, converting image to base64 and sending as `/analyse` request in `frontend/src/components/ai/AIContextMenu.tsx`
- [x] T017 [P] [US4] Detect right-click on `<img>` elements in `handleContextMenu`, capture image URL and pass to context menu as `imageUrl` in `frontend/src/components/editor/InlineEditor.tsx`

**✓ Checkpoint**: Right-clicking an image in the editor shows "Check Compliance" and triggers analysis

---

## Phase 6: Polish & Cross-Cutting — ✅ Completed

**Beads Phase ID**: `echo-portal-owrn`
**Purpose**: Audit event tests, e2e tests, edge case tests, final validation
**Dependencies**: Phases 3, 4, 5 complete

- [x] T018 [P] Audit event test coverage: verify `compliance.analysis_requested` is logged with correct metadata (imageCount, enabledCategories, providerId) in T007's code path, and `compliance.config_changed` is logged with old/new values in T008's code path in `backend/tests/integration/compliance-analysis.test.ts`
- [x] T019 [P] E2e smoke tests: context menu on image triggers compliance check, admin config panel category toggles persist in `frontend/tests/e2e/compliance-analysis.spec.ts`
- [x] T020 [P] Edge case test coverage: verify all-categories-disabled returns COMPLIANCE_DISABLED error (implementation in T007), no-context-docs produces valid prompt (implementation in T002), and provider errors surface through existing error handling in `backend/tests/unit/compliance-prompts.test.ts` and `backend/tests/integration/compliance-analysis.test.ts`
- [x] T021 Run `quickstart.md` validation end-to-end: walk through all 8 steps and verify implementation matches spec

**✓ Checkpoint**: Feature complete — all audit events logged, edge cases handled, e2e tests passing

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ──────────────────────────────┐
    │                                                │
    ├────────────────┬────────────────┐              │
    ▼                ▼                ▼              │
Phase 3: US1/US2  Phase 4: US3    Phase 5: US4     │ (parallel)
(P1 MVP 🎯)       (P2)            (P2)             │
    │                │                │              │
    └────────────────┴────────────────┘              │
                     │                               │
                     ▼                               │
             Phase 6: Polish ◄───────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1/US2 (P1)** → MVP — backend tests verifying core compliance flow
4. **US3 + US4 (P2)** → Can run in parallel with each other and with Phase 3
5. **Polish** → After all story phases complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1/US2 (MVP) → STOP & VALIDATE → [US3 → US4 → Polish]
```

Ship after Phase 3 if viable. Backend compliance analysis fully functional; admin uses default config.

### Strategy B: Parallel Team

```
All: Setup → Foundational
Then split:
  Dev A: US1/US2 (P1) — backend tests
  Dev B: US3 (P2) — admin config UI
  Dev C: US4 (P2) — context menu
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1/US2 → US3 → US4 → Polish
```

One phase at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# Both [P] tasks in parallel
T001 & T002
wait
```

### Within Foundational Phase

```bash
# Independent infrastructure tasks in parallel
T003 & T004 & T005 & T006
wait

# Dependent tasks sequentially
T007  # depends on T004, T005, T006
T008  # depends on T003, T004
```

### Across User Stories

```bash
# After Foundational complete, stories in parallel
(Phase 3: US1/US2) & (Phase 4: US3) & (Phase 5: US4)
wait
# Then Polish
```

---

## Beads ID Mapping

> **Beads tracking is ACTIVE**

| Task ID | Beads ID | Phase |
|---------|----------|-------|
| T001 | `echo-portal-krno` | Phase 1: Setup |
| T002 | `echo-portal-w25o` | Phase 1: Setup |
| T003 | `echo-portal-wjav` | Phase 2: Foundational |
| T004 | `echo-portal-quat` | Phase 2: Foundational |
| T005 | `echo-portal-2joy` | Phase 2: Foundational |
| T006 | `echo-portal-tk06` | Phase 2: Foundational |
| T007 | `echo-portal-84lt` | Phase 2: Foundational |
| T008 | `echo-portal-wts5` | Phase 2: Foundational |
| T009 | `echo-portal-b428` | Phase 3: US1/US2 |
| T010 | `echo-portal-rrwz` | Phase 3: US1/US2 |
| T011 | `echo-portal-4qjm` | Phase 3: US1/US2 |
| T012 | `echo-portal-3779` | Phase 4: US3 (test) |
| T013 | `echo-portal-u5vm` | Phase 4: US3 (api service) |
| T014 | `echo-portal-j8g9` | Phase 4: US3 (config panel) |
| T015 | `echo-portal-mp35` | Phase 5: US4 (test) |
| T016 | `echo-portal-h569` | Phase 5: US4 (context menu) |
| T017 | `echo-portal-4q1w` | Phase 5: US4 (editor) |
| T018 | `echo-portal-4egn` | Phase 6: Polish |
| T019 | `echo-portal-d0jf` | Phase 6: Polish |
| T020 | `echo-portal-cgh5` | Phase 6: Polish |
| T021 | `echo-portal-tmt8` | Phase 6: Polish |

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- US1 and US2 share implementation — US2 is verified via integration test role checks in T011
- No new database tables — all config stored in existing `ai_configurations` table with scope `'compliance'`
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state
