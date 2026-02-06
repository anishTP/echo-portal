---
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
handoffs: 
  - label: Analyze For Consistency
    agent: speckit.analyze
    prompt: Run a project analysis for consistency
    send: true
  - label: Implement Project
    agent: speckit.implement
    prompt: Start the implementation in phases
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)

4. **Generate tasks.md**: Use `.specify/templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - Phase 1: Setup tasks (project initialization)
   - Phase 2: Foundational tasks (blocking prerequisites for all user stories)
   - Phase 3+: One phase per user story (in priority order from spec.md)
   - Each phase includes: story goal, independent test criteria, tests (if requested), implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict checklist format (see Task Generation Rules below)
   - Clear file paths for each task
   - Dependencies section showing story completion order
   - Parallel execution examples per story
   - Implementation strategy section (MVP first, incremental delivery)

5. **Create Beads Tracking** (if `.beads/` directory exists in repo root):

   a. **Create Epic**:
      ```bash
      bd create --title "{Feature Name}" --type epic --priority 1
      ```
      Save the returned ID as EPIC_ID.

   b. **Create Phases** (one per phase in tasks.md):
      ```bash
      bd create --title "Phase 1: {Phase Title}" --type feature --priority {1|2|3}
      ```
      Save each phase ID. Use priority 1 for MVP phases (P1), 2 for P2, 3 for P3.

   c. **Link Phases to Epic**:
      ```bash
      bd update {phase-id} --parent {EPIC_ID}
      ```

   d. **Set Phase Dependencies**:
      - Phase 2 depends on Phase 1: `bd dep add {P2} {P1}`
      - User Story phases depend on Foundational: `bd dep add {US-phase} {P2}`
      - P2/P3 phases depend on MVP completion (last P1 phase)
      - Integration depends on all MVP phases
      - Polish depends on Integration

   e. **Create Individual Tasks** (for each task T001, T002, etc.):
      ```bash
      bd create --title "T001: {Task Description}" --type task --priority {1|2|3}
      ```
      Use parallel subagents to create tasks efficiently (batch by phase).

   f. **Link Tasks to Phases**:
      ```bash
      bd update {task-id} --parent {phase-id}
      ```

   g. **Set Task Dependencies** (within phases):
      - For sequential tasks (no [P] marker), set dependencies
      - Example: `bd dep add {T008} {T001}` if T008 depends on T001

   h. **Update tasks.md** with Beads IDs:
      - Add Task ID to Beads ID mapping table in the Beads Tracking section
      - Update phase IDs in each phase header
      - Add note that beads tracking is active

   i. **Sync Beads**: Run `bd sync` to persist changes

6. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the checklist format (checkbox, ID, labels, file paths)
   - Beads tracking status:
     - Epic ID
     - Phase IDs (table)
     - Total tasks created in beads
     - Ready work count (tasks with no blockers)

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context.

## Task Generation Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**Tests are OPTIONAL**: Only generate test tasks if explicitly requested in the feature specification or if user requests TDD approach.

### Checklist Format (REQUIRED)

Every task MUST strictly follow this format:

```text
- [ ] [TaskID] [P?] [Story?] Description with file path
```

**Format Components**:

1. **Checkbox**: ALWAYS start with `- [ ]` (markdown checkbox)
2. **Task ID**: Sequential number (T001, T002, T003...) in execution order
3. **[P] marker**: Include ONLY if task is parallelizable (different files, no dependencies on incomplete tasks)
4. **[Story] label**: REQUIRED for user story phase tasks only
   - Format: [US1], [US2], [US3], etc. (maps to user stories from spec.md)
   - Setup phase: NO story label
   - Foundational phase: NO story label  
   - User Story phases: MUST have story label
   - Polish phase: NO story label
5. **Description**: Clear action with exact file path

**Examples**:

- ✅ CORRECT: `- [ ] T001 Create project structure per implementation plan`
- ✅ CORRECT: `- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py`
- ✅ CORRECT: `- [ ] T012 [P] [US1] Create User model in src/models/user.py`
- ✅ CORRECT: `- [ ] T014 [US1] Implement UserService in src/services/user_service.py`
- ❌ WRONG: `- [ ] Create User model` (missing ID and Story label)
- ❌ WRONG: `T001 [US1] Create model` (missing checkbox)
- ❌ WRONG: `- [ ] [US1] Create User model` (missing Task ID)
- ❌ WRONG: `- [ ] T001 [US1] Create model` (missing file path)

### Task Organization

1. **From User Stories (spec.md)** - PRIMARY ORGANIZATION:
   - Each user story (P1, P2, P3...) gets its own phase
   - Map all related components to their story:
     - Models needed for that story
     - Services needed for that story
     - Endpoints/UI needed for that story
     - If tests requested: Tests specific to that story
   - Mark story dependencies (most stories should be independent)

2. **From Contracts**:
   - Map each contract/endpoint → to the user story it serves
   - If tests requested: Each contract → contract test task [P] before implementation in that story's phase

3. **From Data Model**:
   - Map each entity to the user story(ies) that need it
   - If entity serves multiple stories: Put in earliest story or Setup phase
   - Relationships → service layer tasks in appropriate story phase

4. **From Setup/Infrastructure**:
   - Shared infrastructure → Setup phase (Phase 1)
   - Foundational/blocking tasks → Foundational phase (Phase 2)
   - Story-specific setup → within that story's phase

### Phase Structure

- **Phase 1**: Setup (project initialization)
- **Phase 2**: Foundational (blocking prerequisites - MUST complete before user stories)
- **Phase 3+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Tests (if requested) → Models → Services → Endpoints → Integration
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns

## Beads Tracking Workflow

When beads tracking is enabled (`.beads/` directory exists), create a full issue hierarchy:

### Hierarchy Structure

```
Epic: {Feature Name}
├── Phase 1: Setup
│   ├── T001: {task}
│   ├── T002: {task}
│   └── ...
├── Phase 2: Foundational
│   ├── T00x: {task}
│   └── ...
├── Phase 3: US1 - {User Story Title} (MVP)
│   ├── T0xx: {task}
│   └── ...
├── Phase N: Polish
│   └── ...
```

### Dependency Rules

1. **Phase-level dependencies**:
   - Setup → Foundational → User Stories (parallel) → Integration → Polish
   - P2/P3 user stories depend on MVP (P1) completion

2. **Task-level dependencies** (within a phase):
   - Tasks marked `[P]` have no intra-phase dependencies
   - Sequential tasks (no `[P]`) depend on prior tasks
   - Example: If T008 runs migrations, it depends on T001-T004 (schema definitions)

3. **Cross-phase dependencies**:
   - All phase tasks implicitly depend on their phase
   - Phase dependencies handle cross-phase blocking

### Efficient Task Creation

Use parallel subagents to create tasks by phase:

```bash
# Create all Phase 1 tasks in parallel
for task in "T001: ..." "T002: ..." ...; do
  bd create --title "$task" --type task --priority 1 &
done
wait

# Link to parent phase
for task_id in {task-ids}; do
  bd update $task_id --parent {phase-id}
done
```

### Required Updates to tasks.md

After creating beads issues, update tasks.md:

1. **Beads Tracking section**: Add task ID mapping table
2. **Phase headers**: Update `{phase-id}` placeholders with actual IDs
3. **Status note**: Add "Beads tracking is ACTIVE" indicator

### Session Close Protocol

After completing beads setup:

```bash
bd sync                          # Sync beads changes
git add specs/{feature}/tasks.md # Stage updated tasks.md
git commit -m "feat: Add tasks with beads tracking"
git push
```
