---
description: "Task list template for feature implementation"
globs: ["specs/**/tasks.md"]
---

# Tasks: {Feature Name}

**Feature**: `specs/{feature}/`  
**Input Documents**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/  
**Validation**: quickstart.md

---

## Beads Tracking

| Property | Value |
|----------|-------|
| **Epic ID** | `{epic-id}` |
| **Spec Label** | `spec:{feature}` |
| **User Stories Source** | `specs/{feature}/spec.md` |
| **Planning Details** | `specs/{feature}/plan.md` |
| **Data Model** | `specs/{feature}/data-model.md` |

> **NOTE**: Run the Beads Issue Creation Script (at end of file) after generating this tasks.md to create the epic and phase issues in beads.

---

## Overview

| Property | Value |
|----------|-------|
| **Epic** | {Feature Name} |
| **User Stories** | {count} from spec.md |
| **Priority** | P1 (MVP) → P2 → P3 |
| **Est. Tasks** | {total count} |

### Constitution Compliance

All tasks MUST comply with Echo Portal Constitution v1.0.0:
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

## Query Hints

### Markdown Queries (grep)

```bash
# Filter by phase
grep -E "^- \[ \].*Phase 1" tasks.md

# Filter by user story
grep -E "\[US1\]" tasks.md

# Find parallelizable tasks
grep -E "\[P\]" tasks.md

# Find blocked tasks
grep -E "⚠️" tasks.md

# Count remaining tasks
grep -c "^- \[ \]" tasks.md
```

### Beads Queries (bd CLI)

> **NOTE**: View comments when working on tasks - implementation details are documented there.

```bash
# All open tasks for this feature
bd list --label 'spec:{feature}' --status open --limit 20

# Task tree from epic
bd dep tree --reverse {epic-id}

# Ready tasks (no blockers)
bd ready --limit 5

# By phase
bd list --label 'phase:setup' --label 'spec:{feature}'
bd list --label 'phase:foundational' --label 'spec:{feature}'
bd list --label 'phase:us1' --label 'spec:{feature}'
bd list --label 'phase:us2' --label 'spec:{feature}'
bd list --label 'phase:polish' --label 'spec:{feature}'

# By component (if using component labels)
bd list --label 'component:frontend' --label 'spec:{feature}'
bd list --label 'component:api' --label 'spec:{feature}'

# Task details and comments
bd show {id}
bd comments {id}
```

<!-- 
  For issue tracker integration, map tasks using labels:
  - spec:{feature}
  - phase:{setup|foundational|us1|us2|polish}
  - priority:{p1|p2|p3}
  - parallel:true
-->

---

## Path Conventions

Adjust paths based on `plan.md` project structure:

| Project Type | Source | Components | Tests |
|--------------|--------|------------|-------|
| React/Vite SPA | `src/` | `src/components/` | `src/__tests__/` or `tests/` |
| Next.js | `app/` or `src/` | `components/` | `__tests__/` |
| Full-stack web | `backend/src/`, `frontend/src/` | `frontend/src/components/` | `*/tests/` |
| Mobile (React Native) | `src/` | `src/components/` | `__tests__/` |
| Monorepo | `packages/{name}/src/` | varies | `packages/{name}/__tests__/` |

### React/Vite/TypeScript Conventions

| Directory | Purpose |
|-----------|---------|
| `src/components/` | Reusable UI components |
| `src/pages/` or `src/views/` | Page-level components |
| `src/hooks/` | Custom React hooks |
| `src/utils/` or `src/lib/` | Utility functions |
| `src/services/` or `src/api/` | API client and data fetching |
| `src/stores/` or `src/state/` | State management (Zustand, Redux, etc.) |
| `src/types/` | TypeScript type definitions |
| `src/assets/` | Static assets (images, fonts) |
| `public/` | Public static files |

---

<!-- 
============================================================================
IMPORTANT: The phases below contain SAMPLE TASKS for illustration only.

When generating tasks.md, REPLACE these samples with actual tasks based on:
- User stories from spec.md (with priorities P1, P2, P3)
- Architecture from plan.md
- Entities from data-model.md  
- Endpoints from contracts/

Tasks MUST be organized so each user story can be:
- Implemented independently
- Tested independently
- Delivered as an MVP increment

DO NOT keep sample tasks in the generated file.
============================================================================
-->

## Phase 1: Setup — ⬜ Pending

**Beads Phase ID**: `{phase-1-id}`  
**Purpose**: Project initialization, dependencies, tooling  
**Blocks**: All subsequent phases  
**Parallelism**: Most tasks can run in parallel

- [ ] T001 [P] Create project structure per `plan.md` architecture
- [ ] T002 [P] Initialize project with dependencies in `package.json`
- [ ] T003 [P] Configure linting/formatting in `eslint.config.js` and `tsconfig.json`
- [ ] T004 [P] Setup environment config in `.env.example` with Vite env vars (`VITE_*`)
- [ ] T005 [P] Create test utilities in `src/__tests__/setup.ts` or `tests/testUtils.ts`

**✓ Checkpoint**: `npm run dev` works, `npm run lint` passes, `npm run test` executes

---

## Phase 2: Foundational — ⬜ Pending

**Beads Phase ID**: `{phase-2-id}`  
**Purpose**: Core infrastructure ALL user stories depend on  
**Blocks**: All user story implementation  
**⚠️ CRITICAL**: No user story work until this phase completes

- [ ] T006 Setup routing structure in `src/router/` or `src/App.tsx` (React Router, TanStack Router)
- [ ] T007 [P] Implement auth context/hooks in `src/hooks/useAuth.ts` and `src/context/AuthContext.tsx`
- [ ] T008 [P] Setup API client/services in `src/services/api.ts` or `src/lib/api.ts`
- [ ] T009 [P] Create base types/interfaces in `src/types/index.ts`
- [ ] T010 [P] Configure error boundary in `src/components/ErrorBoundary.tsx`
- [ ] T011 [P] Setup state management in `src/stores/` (Zustand, Redux, Jotai, etc.)

**✓ Checkpoint**: Foundation ready — user stories can begin in parallel

---

## Phase 3: User Story 1 — {Title} (P1) 🎯 MVP — ⬜ Pending

**Beads Phase ID**: `{phase-3-id}`  
**Goal**: {Brief description of value delivered}  
**Acceptance**: {How to verify this story works independently}  
**Dependencies**: Phase 2 complete

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X: Testing as Contract)

- [ ] T012 [P] [US1] Component test `src/__tests__/components/{Component}.test.tsx`
- [ ] T013 [P] [US1] Integration test `src/__tests__/integration/{feature}.test.tsx`

### Implementation

- [ ] T014 [P] [US1] Create `{Component1}` in `src/components/{Feature}/{Component1}.tsx`
- [ ] T015 [P] [US1] Create `{Component2}` in `src/components/{Feature}/{Component2}.tsx`
- [ ] T016 [US1] Implement `{hook}` in `src/hooks/use{Feature}.ts` *(depends: T014, T015)*
- [ ] T017 [US1] Implement API service in `src/services/{feature}Service.ts`
- [ ] T018 [US1] Add form validation with Zod/Yup in `src/schemas/{feature}Schema.ts`
- [ ] T019 [US1] Wire routes in `src/router/` or update `App.tsx`

**✓ Checkpoint**: User Story 1 functional and independently testable

---

## Phase 4: User Story 2 — {Title} (P2) — ⬜ Pending

**Beads Phase ID**: `{phase-4-id}`  
**Goal**: {Brief description of value delivered}  
**Acceptance**: {How to verify this story works independently}  
**Dependencies**: Phase 2 complete (can run parallel with US1)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X: Testing as Contract)

- [ ] T020 [P] [US2] Component test `src/__tests__/components/{Component}.test.tsx`
- [ ] T021 [P] [US2] Integration test `src/__tests__/integration/{feature}.test.tsx`

### Implementation

- [ ] T022 [P] [US2] Create `{Component}` in `src/components/{Feature}/{Component}.tsx`
- [ ] T023 [US2] Implement `{hook}` in `src/hooks/use{Feature}.ts`
- [ ] T024 [US2] Implement page/view in `src/pages/{Feature}Page.tsx`
- [ ] T025 [US2] Integrate with US1 components *(if needed)*

**✓ Checkpoint**: User Stories 1 & 2 both work independently

---

## Phase 5: User Story 3 — {Title} (P3) — ⬜ Pending

**Beads Phase ID**: `{phase-5-id}`  
**Goal**: {Brief description of value delivered}  
**Acceptance**: {How to verify this story works independently}  
**Dependencies**: Phase 2 complete (can run parallel with US1, US2)

### Tests ⚠️ MANDATORY - Write FIRST, verify they FAIL (Constitution X: Testing as Contract)

- [ ] T026 [P] [US3] Component test `src/__tests__/components/{Component}.test.tsx`
- [ ] T027 [P] [US3] Integration test `src/__tests__/integration/{feature}.test.tsx`

### Implementation

- [ ] T028 [P] [US3] Create `{Component}` in `src/components/{Feature}/{Component}.tsx`
- [ ] T029 [US3] Implement `{hook}` in `src/hooks/use{Feature}.ts`
- [ ] T030 [US3] Implement page/view in `src/pages/{Feature}Page.tsx`

**✓ Checkpoint**: All user stories independently functional

---

## Phase N: Polish & Cross-Cutting — ⬜ Pending

**Beads Phase ID**: `{phase-n-id}`  
**Purpose**: Quality improvements affecting multiple stories  
**Dependencies**: All desired user stories complete

- [ ] T031 [P] Update documentation in `docs/` or `README.md`
- [ ] T032 [P] Add edge case tests in `src/__tests__/`
- [ ] T033 [P] Performance optimization (React.memo, useMemo, lazy loading)
- [ ] T034 [P] Accessibility (a11y) review and ARIA improvements
- [ ] T035 Run `quickstart.md` validation end-to-end
- [ ] T036 Code cleanup, refactoring, and bundle size optimization

**✓ Checkpoint**: Feature complete, documented, production-ready

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational ──────────────────────────┐
    │                                           │
    ├───────────────┬───────────────┐           │
    ▼               ▼               ▼           │
Phase 3: US1    Phase 4: US2    Phase 5: US3   │ (parallel)
(P1 MVP 🎯)      (P2)            (P3)           │
    │               │               │           │
    └───────────────┴───────────────┘           │
                    │                           │
                    ▼                           │
            Phase N: Polish ◄───────────────────┘
```

### Key Rules

1. **Setup** → No dependencies, start immediately
2. **Foundational** → Blocks ALL user stories
3. **User Stories** → Can run in parallel after Foundational
4. **Within each story**: Tests → Models → Services → Handlers → Integration
5. **Polish** → After all desired stories complete

---

## Execution Strategies

### Strategy A: MVP First (Solo Developer)

```
Setup → Foundational → US1 (MVP) → STOP & VALIDATE → [US2 → US3 → Polish]
```

Ship after US1 if viable. Add stories incrementally.

### Strategy B: Parallel Team

```
All: Setup → Foundational
Then split:
  Dev A: US1 (P1)
  Dev B: US2 (P2)  
  Dev C: US3 (P3)
Sync: Polish
```

### Strategy C: Sequential Priority

```
Setup → Foundational → US1 → US2 → US3 → Polish
```

One story at a time, in priority order.

---

## Parallel Execution Examples

### Within Setup Phase

```bash
# All [P] tasks in parallel
T001 & T002 & T003 & T004 & T005
wait
```

### Within a User Story

```bash
# Tests first (parallel)
T012 & T013
wait

# Models (parallel)
T014 & T015
wait

# Services (sequential - depends on models)
T016
T017
T018
T019
```

### Across User Stories

```bash
# After Foundational complete, stories in parallel
(Phase 3: US1) & (Phase 4: US2) & (Phase 5: US3)
wait
# Then Polish
```

---

## Completion Tracking

### Task Completion (Markdown + Beads)

```markdown
- [x] T001 [P] Description `path/file.ext` — ✅ (2024-01-15)
```

```bash
# Update beads when completing a task
bd update {task-id} --status in_progress  # Before starting
bd close {task-id} --reason "Implemented {file}"  # After completion
bd sync  # Sync changes
```

### Phase Completion

```markdown
## Phase 1: Setup — ✅ COMPLETED (2024-01-15)

**Beads Phase ID**: `{phase-1-id}` — ✅ CLOSED
**Completed Tasks**: T001, T002, T003, T004, T005
```

```bash
# Close phase in beads
bd close {phase-1-id} --reason "All setup tasks complete"
bd sync
```

### Story Completion

```markdown
## Phase 3: User Story 1 — {Title} (P1) 🎯 MVP — ✅ COMPLETED (2024-01-16)

**Beads Phase ID**: `{phase-3-id}` — ✅ CLOSED
**Acceptance Verified**: ✅ {validation notes}
**Completed Tasks**: T012-T019
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
- **Beads sync**: Always run `bd sync` at end of session to persist tracking state

---

## Beads Issue Creation Script

Run this script after generating tasks.md to create the epic and phase structure in beads:

```bash
#!/bin/bash
# Replace {feature} and {Feature Title} with actual values
FEATURE="{feature}"
FEATURE_TITLE="{Feature Title}"
LABEL="spec:${FEATURE}"

# Create epic
EPIC=$(bd create "$FEATURE_TITLE" -t epic -p 1 -l "$LABEL" --json | jq -r '.id')
echo "Created Epic: $EPIC"

# Create phases
P1=$(bd create "Phase 1: Setup" -t feature -p 1 -l "$LABEL,phase:setup" --parent $EPIC --json | jq -r '.id')
P2=$(bd create "Phase 2: Foundational" -t feature -p 1 -l "$LABEL,phase:foundational" --parent $EPIC --json | jq -r '.id')
P3=$(bd create "Phase 3: User Story 1 (MVP)" -t feature -p 1 -l "$LABEL,phase:us1" --parent $EPIC --json | jq -r '.id')
P4=$(bd create "Phase 4: User Story 2" -t feature -p 2 -l "$LABEL,phase:us2" --parent $EPIC --json | jq -r '.id')
P5=$(bd create "Phase 5: User Story 3" -t feature -p 3 -l "$LABEL,phase:us3" --parent $EPIC --json | jq -r '.id')
PN=$(bd create "Phase N: Polish" -t feature -p 3 -l "$LABEL,phase:polish" --parent $EPIC --json | jq -r '.id')

echo "Created Phases: P1=$P1, P2=$P2, P3=$P3, P4=$P4, P5=$P5, PN=$PN"

# Set phase dependencies
bd dep add $P2 $P1  # Foundational depends on Setup
bd dep add $P3 $P2  # US1 depends on Foundational
bd dep add $P4 $P2  # US2 depends on Foundational (parallel with US1)
bd dep add $P5 $P2  # US3 depends on Foundational (parallel with US1, US2)
bd dep add $PN $P3  # Polish depends on US1 (MVP)
bd dep add $PN $P4  # Polish depends on US2
bd dep add $PN $P5  # Polish depends on US3

echo "Dependencies configured"

# Sync and show tree
bd sync
bd dep tree $EPIC

echo ""
echo "Update tasks.md with these IDs:"
echo "  Epic ID: $EPIC"
echo "  Phase 1 (Setup): $P1"
echo "  Phase 2 (Foundational): $P2"
echo "  Phase 3 (US1 MVP): $P3"
echo "  Phase 4 (US2): $P4"
echo "  Phase 5 (US3): $P5"
echo "  Phase N (Polish): $PN"
```

### Labels Reference

| Label | Purpose |
|-------|--------|
| `spec:{feature}` | Links all issues to this feature |
| `phase:setup` | Setup phase tasks |
| `phase:foundational` | Foundational/blocking tasks |
| `phase:us1`, `phase:us2`, etc. | User story phases |
| `phase:polish` | Polish and cross-cutting |
| `parallel:true` | Task is parallelizable |
| `component:{name}` | Optional component grouping |

### Session Management

**Start of session:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:{feature}' --status in_progress
bd ready --limit 5
```

**End of session (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```
