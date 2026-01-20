# BD-Ready tasks.md Template

Use this template when generating tasks.md via `/speckit.tasks`.

```markdown
# Tasks Index: {Feature Title} - {Phase}

**Input**: Design documents from `specs/{feature}/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow

1. Load plan.md for tech stack and architecture
2. Extract entities from data-model.md for model tasks
3. Parse contracts/ for API test coverage
4. Generate ordered tasks: Setup → Tests → Implementation → Integration → Polish
5. Validate no missing dependencies

---

## Feature Tracking

**Beads Epic ID**: `{epic-id}`
**User Stories Source**: `specs/{feature}/spec.md`
**Planning Details**: `specs/{feature}/plan.md`
**Data Model**: `specs/{feature}/data-model.md`
**Contract Definitions**: `specs/{feature}/contracts/`

---

## Beads Query Hints

> NOTE: View comments when working on tasks - implementation details are documented there.

```bash
# All open tasks for this feature
bd list --label 'spec:{feature}' --status open --limit 20

# Task tree
bd dep tree --reverse {epic-id}

# Ready tasks
bd ready --limit 5

# By phase
bd list --label 'phase:setup' --label 'spec:{feature}'
bd list --label 'phase:tests' --label 'spec:{feature}'
bd list --label 'phase:impl' --label 'spec:{feature}'

# By component
bd list --label 'component:webapp' --label 'spec:{feature}'
bd list --label 'component:api' --label 'spec:{feature}'

# Task details
bd show {id}
bd comments {id}
```

---

## Phases Structure

- **Epic**: `{epic-id}` ({Feature Title})
- **Phase 1: Setup**: `{id}` - ⬜ **Pending**
- **Phase 2: Tests First**: `{id}` - ⬜ **Pending**  
- **Phase 3: Implementation**: `{id}` - ⬜ **Pending**
- **Phase 4: Integration**: `{id}` - ⬜ **Pending**
- **Phase 5: Polish**: `{id}` - ⬜ **Pending**

---

## Implementation Strategy

1. **Phase 1: Setup** (P1) - ⬜ **Pending**
   - Install dependencies, configure tooling

2. **Phase 2: Tests First** (P1) - ⬜ **Pending**
   - Contract tests, integration test skeletons

3. **Phase 3: Implementation** (P2) - ⬜ **Pending**
   - Models, services, handlers

4. **Phase 4: Integration** (P2) - ⬜ **Pending**
   - Wire components, state management

5. **Phase 5: Polish** (P3) - ⬜ **Pending**
   - Error handling, docs, optimization

---

## Format

`- [ ] T001 [P] Description \`path/file.ts\` doing X`

- **[P]** = Parallelizable (different files, no blocking deps)
- Every task lists concrete file paths

---

## Phase 1: Setup

- [ ] T001 Update `{path}/package.json` with dependencies: `{deps}`
- [ ] T002 Create `{path}/config.ts` for `{tool}` configuration
- [ ] T003 Scaffold `{path}/testUtils.tsx` with `{helper}` helper

## Phase 2: Tests First (TDD) ⚠️ write before implementation

- [ ] T004 [P] Add contract test `{path}/contract_test.go`
- [ ] T005 [P] Add repository test `{path}/repository_test.go`
- [ ] T006 [P] Add service test `{path}/service_test.go`
- [ ] T007 [P] Add handler test `{path}/handler_test.go`

## Phase 3: Implementation

- [ ] T010 Create `{path}/models/config.ts` with `{Model}` type
- [ ] T011 Implement `{Adapter}` in `{path}/adapter.ts`
- [ ] T012 Add `{Method}` to `{path}/service.go`

## Phase 4: Integration

- [ ] T020 Wire `{Context}` provider in `{path}/Context.tsx`
- [ ] T021 Implement `{useData}` hook in `{path}/hooks/useData.ts`
- [ ] T022 Connect `{path}/App.tsx` to adapter

## Phase 5: Polish

- [ ] T030 [P] Add error handling tests `{path}/errors.test.ts`
- [ ] T031 [P] Update `{path}/README.md` with setup instructions

---

## Parallel Execution Example

```bash
task run T004 &  # contract test
task run T005 &  # repository test
task run T006 &  # service test
wait
```

---

## Notes

- Keep generated code in sync with proto changes
- Respect existing linter/formatter conventions
- Place tests alongside source files

---

## Beads Issue Creation Script

```bash
#!/bin/bash
FEATURE="{feature}"
LABEL="spec:${FEATURE}"

EPIC=$(bd create "{Feature Title}" -t epic -p 1 -l "$LABEL" --json | jq -r '.id')

P1=$(bd create "Phase 1: Setup" -t feature -p 1 -l "$LABEL,phase:setup" --parent $EPIC --json | jq -r '.id')
P2=$(bd create "Phase 2: Tests" -t feature -p 1 -l "$LABEL,phase:tests" --parent $EPIC --json | jq -r '.id')
P3=$(bd create "Phase 3: Impl" -t feature -p 2 -l "$LABEL,phase:impl" --parent $EPIC --json | jq -r '.id')
P4=$(bd create "Phase 4: Integration" -t feature -p 2 -l "$LABEL,phase:integration" --parent $EPIC --json | jq -r '.id')
P5=$(bd create "Phase 5: Polish" -t feature -p 3 -l "$LABEL,phase:polish" --parent $EPIC --json | jq -r '.id')

bd dep add $P2 $P1
bd dep add $P3 $P2
bd dep add $P4 $P3
bd dep add $P5 $P4

bd sync
bd dep tree $EPIC
```
```

## Status Icons

| Icon | Status |
|------|--------|
| ⬜ | Pending |
| 🔄 | In Progress |
| ✅ | Completed |
| ⚠️ | Blocked |

## Completion Format

When tasks complete, update:

```markdown
- [x] T001 Description `path` - ✅ **COMPLETED** (YYYY-MM-DD)
```

When closing phase:

```markdown
- **Phase 1: Setup**: `{id}` - ✅ **COMPLETED** (YYYY-MM-DD)
  - **Tasks Closed**: grid-t001, grid-t002, grid-t003
```
