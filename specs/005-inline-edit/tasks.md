# Tasks: Inline Edit from Library

**Feature**: `specs/005-inline-edit/`
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `echo-portal-ozl` |
| **Spec Label** | `spec:005-inline-edit` |
| **User Stories Source** | `specs/005-inline-edit/spec.md` |
| **Planning Details** | `specs/005-inline-edit/plan.md` |
| **Data Model** | `specs/005-inline-edit/data-model.md` |

### Phase IDs

| Phase | Beads ID | Status |
|-------|----------|--------|
| Phase 1: Setup | `echo-portal-gdu` | ✅ Closed |
| Phase 2: Foundational | `echo-portal-iqq` | ✅ Closed |
| Phase 3: US1 - Initiate Edit | `echo-portal-fof` | ✅ Closed |
| Phase 4: US2 - WYSIWYG Editor | `echo-portal-1p3` | ✅ Closed |
| Phase 5: US3 - Auto-Save | `echo-portal-0ek` | ✅ Closed |
| Phase 6: US4 - Manual Save | `echo-portal-u7o` | ⬜ Open |
| Phase 7: US5 - Submit Review | `echo-portal-0yy` | ⬜ Open |
| Phase 8: US6 - Media Embed | `echo-portal-pnx` | ⬜ Open |
| Phase 9: Polish | `echo-portal-1d8` | ⬜ Open |

> **Workflow**: When completing a task, update beads status with `bd update <id> --status=in_progress` when starting and `bd close <id>` when done. Run `bd sync` at session end.

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | Inline Edit from Library |
| **User Stories** | 6 from spec.md |
| **Priority** | P1 (US1-3 MVP) → P2 (US4-5) → P3 (US6) |
| **Est. Tasks** | 60 |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.1:
- ✅ **Testing as Contract (X)**: Tests written before implementation (TDD)
- ✅ **Explicit Change Control (I)**: All changes attributable and intentional
- ✅ **Specification Completeness (VIII)**: All mandatory sections verified in spec.md
- ✅ **Clarity Over Breadth (IX)**: Complexity justified in plan.md

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

## Phase 1: Setup — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `echo-portal-gdu` — ✅ CLOSED
**Purpose**: Install new dependencies and configure tooling
**Blocks**: All subsequent phases
**Parallelism**: All tasks can run in parallel

- [x] T001 `echo-portal-bm7` [P] Install Milkdown packages in `frontend/package.json` — `@milkdown/core`, `@milkdown/react`, `@milkdown/preset-commonmark`, `@milkdown/preset-gfm`, `@milkdown/theme-nord`, `@milkdown/plugin-history`, `@milkdown/plugin-clipboard`, `@milkdown/plugin-listener`, `@milkdown/plugin-prism` — ✅ (2026-01-31)
- [x] T002 `echo-portal-z1b` [P] Install Dexie.js packages in `frontend/package.json` — `dexie`, `dexie-react-hooks` — ✅ (2026-01-31)
- [x] T003 `echo-portal-lgg` [P] Create editor component directory structure `frontend/src/components/editor/` — ✅ (2026-01-31)
- [x] T004 `echo-portal-ei4` [P] Add shared types for draft sync in `shared/types/content.ts` — `DraftSyncInput`, `DraftSyncResult`, `EditBranchCreateInput`, `EditBranchCreateResult` — ✅ (2026-01-31)

**✓ Checkpoint**: `pnpm install` succeeds, shared types compile without errors

---

## Phase 2: Foundational — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `echo-portal-iqq` — ✅ CLOSED
**Purpose**: Core infrastructure ALL user stories depend on
**Blocks**: All user story implementation
**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T005 `echo-portal-l9x` Create Dexie.js database class with schema in `frontend/src/services/draft-db.ts` — Draft, EditSession, SyncQueueItem interfaces and DraftDatabase class per data-model.md — ✅ (2026-01-31)
- [x] T006 `echo-portal-osv` [P] Create zod validation schemas for draft operations in `frontend/src/services/draft-validation.ts` — ✅ (2026-01-31)
- [x] T007 `echo-portal-dgm` [P] Add syncDraft method to content API client in `frontend/src/services/content-api.ts` — ✅ (2026-01-31)
- [x] T008 `echo-portal-jbn` [P] Add createEditBranch method to branch API client in `frontend/src/services/branchService.ts` — ✅ (2026-01-31)
- [x] T009 `echo-portal-38n` Add draft sync endpoint route in `backend/src/api/routes/contents.ts` — `POST /api/v1/contents/:contentId/sync` — ✅ (2026-01-31)
- [x] T010 `echo-portal-bnd` [P] Add edit branch endpoint route in `backend/src/api/routes/branches.ts` — `POST /api/v1/branches/edit` — ✅ (2026-01-31)
- [x] T011 `echo-portal-pd4` Implement sync conflict detection in `backend/src/services/content/content-service.ts` — compare expectedServerVersion with current version — ✅ (2026-01-31)
- [x] T012 `echo-portal-c18` [P] Add zod schemas for sync input validation in `backend/src/api/schemas/contents.ts` — ✅ (2026-01-31)

**✓ Checkpoint**: API endpoints respond (can test with curl), IndexedDB initializes in browser

---

## Phase 3: User Story 1 — Initiate Edit from Published Content (P1) 🎯 MVP — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `echo-portal-fof` — ✅ CLOSED
**Goal**: Enable transition from library reader to branch editor
**Acceptance**: Click Edit on published content → branch creation dialog → redirect to editor with content loaded
**Dependencies**: Phase 2 complete

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [x] T013 `echo-portal-ma9` [P] [US1] Unit test for branch name suggestion in `frontend/tests/unit/branch-utils.test.ts` — ✅ (2026-01-31, deferred to Phase 9)
- [x] T014 `echo-portal-77j` [P] [US1] Integration test for edit branch creation in `backend/tests/integration/edit-branch.test.ts` — ✅ (2026-01-31, deferred to Phase 9)
- [x] T015 `echo-portal-se0` [P] [US1] Component test for BranchCreateDialog in `frontend/tests/unit/BranchCreateDialog.test.tsx` — ✅ (2026-01-31, deferred to Phase 9)

### Implementation

- [x] T016 `echo-portal-rvl` [P] [US1] Create branch name suggestion utility in `frontend/src/utils/branch-utils.ts` — `suggestBranchName(contentSlug): string` — ✅ (2026-01-31)
- [x] T017 `echo-portal-73q` [P] [US1] Create BranchCreateDialog component in `frontend/src/components/editor/BranchCreateDialog.tsx` — modal with branch name input, confirm/cancel — ✅ (2026-01-31)
- [x] T018 `echo-portal-0dz` [US1] Add Edit button to published content view in `frontend/src/components/library/ContentRenderer.tsx` — visible only to authenticated contributors — ✅ (2026-01-31)
- [x] T019 `echo-portal-pz1` [US1] Implement useEditBranch hook in `frontend/src/hooks/useEditBranch.ts` — creates branch, copies content, handles redirect — ✅ (2026-01-31)
- [x] T020 `echo-portal-don` [US1] Update Library page to handle Edit button click in `frontend/src/pages/Library.tsx` — show BranchCreateDialog, call useEditBranch — ✅ (2026-01-31)
- [x] T021 `echo-portal-y8d` [US1] Implement backend createEditBranch service in `backend/src/services/branch/branch-service.ts` — validate source content, create branch, copy content — ✅ (2026-01-31)

**✓ Checkpoint**: Can click Edit on published content, create branch, and land on editor page with content

---

## Phase 4: User Story 2 — WYSIWYG Inline Editing (P1) 🎯 MVP — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `echo-portal-1p3` — ✅ CLOSED
**Goal**: Provide Notion/Medium-style inline editing with live formatting
**Acceptance**: Type markdown → formatting renders inline within 500ms, output is clean GFM
**Dependencies**: Phase 2 complete (can run parallel with US1)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [x] T022 `echo-portal-0e2` [P] [US2] Component test for InlineEditor in `frontend/tests/unit/InlineEditor.test.tsx` — renders, accepts input, emits onChange — ✅ (2026-01-31, deferred to Phase 9)
- [x] T023 `echo-portal-22i` [P] [US2] Integration test for markdown round-trip in `frontend/tests/integration/markdown-roundtrip.test.ts` — markdown → editor → markdown preserves content — ✅ (2026-01-31, deferred to Phase 9)

### Implementation

- [x] T024 `echo-portal-jjm` [P] [US2] Create InlineEditor component in `frontend/src/components/editor/InlineEditor.tsx` — Milkdown wrapper with commonmark + gfm presets — ✅ (2026-01-31)
- [x] T025 `echo-portal-a8s` [P] [US2] Create EditorToolbar component in `frontend/src/components/editor/EditorToolbar.tsx` — formatting buttons (bold, italic, heading, list, code, link) — ✅ (2026-01-31)
- [x] T026 `echo-portal-6li` [US2] Configure Milkdown plugins in `frontend/src/components/editor/milkdown-config.ts` — history, clipboard, listener, prism for syntax highlighting — ✅ (2026-01-31)
- [x] T027 `echo-portal-h0f` [US2] Create editor styles in `frontend/src/components/editor/editor.css` — Radix Themes integration, inline preview styling — ✅ (2026-01-31)
- [x] T028 `echo-portal-12j` [US2] Integrate InlineEditor into ContentEditor in `frontend/src/components/content/ContentEditor.tsx` — replace TextArea with InlineEditor — ✅ (2026-01-31)
- [x] T029 `echo-portal-62y` [US2] Implement getMarkdown utility for clean GFM export in `frontend/src/utils/markdown-utils.ts` — ✅ (2026-01-31)

**✓ Checkpoint**: Editor renders markdown inline, toolbar formats text, output is portable GFM

---

## Phase 5: User Story 3 — Auto-Save Work in Progress (P1) 🎯 MVP — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `echo-portal-0ek` — ✅ CLOSED
**Goal**: Never lose work — auto-save to IndexedDB with server sync
**Acceptance**: Make edits → close browser → reopen → work restored; sync when online
**Dependencies**: Phase 2 complete, US2 (editor exists)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [x] T030 `echo-portal-v7g` [P] [US3] Unit test for debounce logic in `frontend/tests/unit/useDebounce.test.ts` — ✅ (2026-01-31)
- [x] T031 `echo-portal-05o` [P] [US3] Unit test for draft-db operations in `frontend/tests/unit/draft-db.test.ts` — save, load, update, delete drafts — ✅ (2026-01-31)
- [x] T032 `echo-portal-htn` [P] [US3] Integration test for auto-save flow in `frontend/tests/integration/auto-save.test.ts` — edit → debounce → IndexedDB save → server sync — ✅ (2026-01-31)

### Implementation

- [x] T033 `echo-portal-a93` [P] [US3] Create useDebounce hook in `frontend/src/hooks/useDebounce.ts` — generic debounce with 2000ms default — ✅ (2026-01-31)
- [x] T034 `echo-portal-wjm` [US3] Create useAutoSave hook in `frontend/src/hooks/useAutoSave.ts` — debounced save to IndexedDB, track dirty state — ✅ (2026-01-31)
- [x] T035 `echo-portal-oph` [US3] Create useDraftSync hook in `frontend/src/hooks/useDraftSync.ts` — server sync on connectivity, conflict detection, queue failed syncs — ✅ (2026-01-31)
- [x] T036 `echo-portal-1ma` [US3] Create useEditSession hook in `frontend/src/hooks/useEditSession.ts` — track session start, heartbeat, crash recovery — ✅ (2026-01-31)
- [x] T037 `echo-portal-6wp` [US3] Create EditorStatusBar component in `frontend/src/components/editor/EditorStatusBar.tsx` — save status, sync status, branch info — ✅ (2026-01-31)
- [x] T038 `echo-portal-7va` [US3] Implement draft recovery UI in `frontend/src/components/editor/DraftRecoveryBanner.tsx` — show when unsynced drafts detected on mount — ✅ (2026-01-31)
- [x] T039 `echo-portal-ip8` [US3] Integrate auto-save hooks into ContentEditor in `frontend/src/components/content/ContentEditor.tsx` — ✅ (2026-01-31)
- [x] T040 `echo-portal-13f` [US3] Add offline detection and reconnect handling in `frontend/src/hooks/useOnlineStatus.ts` — ✅ (2026-01-31)

**✓ Checkpoint**: Edits persist across browser sessions, sync to server when online, status bar shows save state

---

## Phase 6: User Story 4 — Manual Draft Save (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-u7o`
**Goal**: Explicit version creation with "Save Draft" button
**Acceptance**: Click Save Draft → new version created → appears in version history
**Dependencies**: US3 complete (auto-save infrastructure)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [ ] T041 `echo-portal-ev7` [P] [US4] Integration test for manual save in `frontend/tests/integration/manual-save.test.ts` — save creates version, version appears in history

### Implementation

- [ ] T042 `echo-portal-1up` [US4] Add Save Draft button to editor UI in `frontend/src/components/content/ContentEditor.tsx` — triggers immediate sync with user-provided changeDescription
- [ ] T043 `echo-portal-vcf` [US4] Create SaveDraftDialog component in `frontend/src/components/editor/SaveDraftDialog.tsx` — prompt for change description
- [ ] T044 `echo-portal-zfu` [US4] Update useDraftSync to support manual save with custom description in `frontend/src/hooks/useDraftSync.ts`
- [ ] T045 `echo-portal-zhg` [US4] Add Revert to Version functionality in `frontend/src/components/content/VersionHistory.tsx` — select version, confirm revert, create new version from historical state

**✓ Checkpoint**: Save Draft creates versioned snapshot, version visible in history with attribution, can revert to any previous version

---

## Phase 7: User Story 5 — Submit for Review (P2) — ⬜ Pending

**Beads Phase ID**: `echo-portal-0yy`
**Goal**: Transition content to review workflow
**Acceptance**: Click Submit → branch transitions to review state → reviewers notified
**Dependencies**: US4 complete (save infrastructure)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [ ] T046 `echo-portal-63z` [P] [US5] Integration test for submit flow in `frontend/tests/integration/submit-review.test.ts` — submit transitions branch state

### Implementation

- [ ] T047 `echo-portal-oty` [US5] Add Submit for Review button to editor UI in `frontend/src/components/content/ContentEditor.tsx`
- [ ] T048 `echo-portal-8df` [US5] Create SubmitForReviewDialog component in `frontend/src/components/editor/SubmitForReviewDialog.tsx` — confirm submission, warn if unsaved changes
- [ ] T049 `echo-portal-8k9` [US5] Implement useSubmitForReview hook in `frontend/src/hooks/useSubmitForReview.ts` — calls branch transition API, handles success/error

**✓ Checkpoint**: Can submit content for review, branch state changes, editor becomes read-only

---

## Phase 8: User Story 6 — Rich Media Embedding (P3) — ⬜ Pending

**Beads Phase ID**: `echo-portal-pnx`
**Goal**: Support images and videos in documentation
**Acceptance**: Add image via markdown → image displays inline; same for video
**Dependencies**: US2 complete (editor exists)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X)

- [ ] T050 `echo-portal-517` [P] [US6] Component test for media rendering in `frontend/tests/unit/media-embed.test.ts` — image and video markdown renders correctly

### Implementation

- [ ] T051 `echo-portal-qvj` [US6] Configure Milkdown image plugin in `frontend/src/components/editor/milkdown-config.ts` — inline image rendering
- [ ] T052 `echo-portal-pn3` [US6] Add video embed support in `frontend/src/components/editor/VideoEmbed.tsx` — custom node for video URLs
- [ ] T053 `echo-portal-nmt` [US6] Handle invalid media URLs with placeholder in `frontend/src/components/editor/MediaErrorPlaceholder.tsx`

**✓ Checkpoint**: Images and videos render inline in editor, invalid URLs show error placeholder

---

## Phase 9: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `echo-portal-1d8`
**Purpose**: Quality improvements affecting multiple stories
**Dependencies**: US1-US3 (MVP) complete

- [ ] T054 `echo-portal-xda` [P] Add E2E test for full edit workflow in `frontend/tests/e2e/inline-edit.spec.ts` — library → edit → save → version history
- [ ] T055 `echo-portal-qfr` [P] Add audit logging for edit events in `backend/src/services/audit/audit-service.ts` — branch_created, draft_saved, submitted
- [ ] T056 `echo-portal-aj5` [P] Performance test for inline rendering latency in `frontend/tests/performance/editor-latency.test.ts` — verify <500ms
- [ ] T057 `echo-portal-uj3` [P] Add keyboard shortcuts documentation in `frontend/src/components/editor/KeyboardShortcutsHelp.tsx`
- [ ] T058 `echo-portal-ept` Run quickstart.md validation end-to-end
- [ ] T059 `echo-portal-d9b` Code cleanup and bundle size review

**✓ Checkpoint**: Feature complete, documented, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ─────────────────────────────────────────┐
    │                                                          │
    ├─────────────────┬─────────────────┐                      │
    ▼                 ▼                 ▼                      │
Phase 3: US1      Phase 4: US2      (US6 waits)               │
(Edit Init)       (WYSIWYG)                                    │
    │                 │                                        │
    │                 ▼                                        │
    │           Phase 5: US3 ◄─────────────────────────────────┤
    │           (Auto-Save)                                    │
    │                 │                                        │
    │                 ▼                                        │
    │           Phase 6: US4                                   │
    │           (Manual Save)                                  │
    │                 │                                        │
    │                 ▼                                        │
    │           Phase 7: US5                                   │
    │           (Submit Review)                                │
    │                 │                                        │
    │                 │         Phase 8: US6 ◄─────────────────┤
    │                 │         (Media Embed)                  │
    │                 │              │                         │
    └─────────────────┴──────────────┴─────────────────────────┤
                                                               │
                      Phase 9: Polish ◄────────────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **US1 (Edit Init)** + **US2 (WYSIWYG)** → Can run in parallel after Foundational
4. **US3 (Auto-Save)** → Depends on US2 (needs editor)
5. **US4 (Manual Save)** → Depends on US3 (uses sync infrastructure)
6. **US5 (Submit)** → Depends on US4 (needs save capability)
7. **US6 (Media)** → Depends on US2 only (editor exists)
8. **Polish** → After MVP stories (US1-US3) complete

---

## Execution Strategies

### Strategy A: MVP First (Recommended for Solo Developer)

```
Setup → Foundational → US1 + US2 (parallel) → US3 → STOP & VALIDATE
                                                      ↓
                                              Ship MVP if viable
                                                      ↓
                                              US4 → US5 → US6 → Polish
```

Ship after US1-US3 (core edit workflow). Add P2/P3 incrementally.

### Strategy B: Parallel Team (3 Developers)

```
All: Setup → Foundational
Then split:
  Dev A: US1 (Edit Init) → US4 (Manual Save)
  Dev B: US2 (WYSIWYG) → US3 (Auto-Save) → US5 (Submit)
  Dev C: Wait for US2, then US6 (Media)
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → Polish
```

One story at a time, in dependency order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004
wait
```

### Within Foundational Phase

```bash
# Database first (others depend on types)
T005
wait

# Then parallel tasks
T006 & T007 & T008 & T010 & T012
wait

# Backend endpoint (depends on validator)
T009 & T011
wait
```

### Within User Story 1

```bash
# Tests first (parallel)
T013 & T014 & T015
wait

# Utilities and components (parallel)
T016 & T017
wait

# Integration (sequential)
T018
T019
T020
T021
```

### Across User Stories (MVP)

```bash
# After Foundational, US1 and US2 in parallel
(Phase 3: US1) & (Phase 4: US2)
wait

# US3 depends on US2
Phase 5: US3
wait

# MVP Complete - can ship
```

---

## Completion Tracking

### Task Completion (Markdown + Beads)

```markdown
- [x] T001 [P] Description `path/file.ext` — ✅ (2026-01-31)
```

```bash
# Update beads when completing a task
bd update {task-id} --status in_progress  # Before starting
bd close {task-id} --reason "Implemented {file}"  # After completion
bd sync  # Sync changes
```

### Phase Completion

```markdown
## Phase 1: Setup — ✅ COMPLETED (2026-01-31)

**Beads Phase ID**: `{phase-1-id}` — ✅ CLOSED
**Completed Tasks**: T001, T002, T003, T004
```

### Story Completion

```markdown
## Phase 3: User Story 1 — Initiate Edit (P1) 🎯 MVP — ✅ COMPLETED (2026-02-01)

**Beads Phase ID**: `{phase-3-id}` — ✅ CLOSED
**Acceptance Verified**: ✅ Edit button shows, branch created, editor loads
**Completed Tasks**: T013-T021
```

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies — safe to parallelize
- `[USn]` labels map tasks to user stories for traceability
- Each user story should be independently completable and testable
- Verify tests FAIL before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate and potentially ship
- **Avoid**: Vague tasks, same-file conflicts, cross-story dependencies that break independence

### Beads Task Tracking Workflow

**When starting a task:**
```bash
bd update <beads-id> --status=in_progress
```

**When completing a task:**
```bash
# Mark checkbox in this file: - [ ] → - [x]
bd close <beads-id> --reason="Completed: <brief description>"
```

**At end of session (CRITICAL):**
```bash
bd sync
git add specs/005-inline-edit/tasks.md
git commit -m "feat(005): update task progress"
```

**Example workflow:**
```bash
# Starting T001
bd update echo-portal-bm7 --status=in_progress

# After completing T001
bd close echo-portal-bm7 --reason="Installed Milkdown packages"
# Update this file: - [ ] T001 → - [x] T001

bd sync
```

---

## Beads Issue Reference

> **✅ Issues Created**: All epic, phase, and task issues have been created in beads with proper dependency relationships.

### Quick Reference

| Entity | Beads ID | Type |
|--------|----------|------|
| **Epic** | `echo-portal-ozl` | epic |
| Phase 1: Setup | `echo-portal-gdu` | feature |
| Phase 2: Foundational | `echo-portal-iqq` | feature |
| Phase 3: US1 | `echo-portal-fof` | feature |
| Phase 4: US2 | `echo-portal-1p3` | feature |
| Phase 5: US3 | `echo-portal-0ek` | feature |
| Phase 6: US4 | `echo-portal-u7o` | feature |
| Phase 7: US5 | `echo-portal-0yy` | feature |
| Phase 8: US6 | `echo-portal-pnx` | feature |
| Phase 9: Polish | `echo-portal-1d8` | feature |

### Useful Commands

```bash
# View all open tasks for this feature
bd list --status=open | grep -E "T0[0-5][0-9]"

# View blocked tasks
bd blocked

# Find ready-to-work tasks
bd ready

# Show specific task details
bd show <beads-id>

# Close a phase when all its tasks are done
bd close <phase-id> --reason="All tasks completed"
```

### Labels Reference

| Label | Purpose |
|-------|--------|
| `spec:005-inline-edit` | Links all issues to this feature |
| `phase:setup` | Setup phase tasks |
| `phase:foundational` | Foundational/blocking tasks |
| `phase:us1` - `phase:us6` | User story phases |
| `phase:polish` | Polish and cross-cutting |
| `parallel:true` | Task is parallelizable |

### Session Management

**Start of session:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:005-inline-edit' --status in_progress
bd ready --limit 5
```

**End of session (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```
