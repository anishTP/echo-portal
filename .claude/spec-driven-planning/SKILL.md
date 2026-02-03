---
name: spec-driven-planning
description: Integrate GitHub spec-kit with beads issue tracking for persistent, dependency-aware development. Use when: (1) running /speckit.* commands and need bd-ready task output, (2) converting specs/plans to tracked beads issues, (3) implementing features while tracking progress in beads, (4) resuming work across sessions with bd ready/sync, (5) managing long-running projects with phase-based execution. Triggers on "plan feature", "generate tasks", "what should I work on", "track this project", or multi-session development.
---

# Spec-Driven Planning with Beads

Integrate spec-kit specification workflow with beads issue tracking.

## Workflow

```
/speckit.specify → /speckit.plan → /speckit.tasks → create bd issues → bd ready → implement → bd close → bd sync
```

## Generate BD-Ready tasks.md

When running `/speckit.tasks`, follow the template in `references/tasks-template.md`. Key sections:

1. **Feature Tracking** - Link to epic ID, spec.md, plan.md, data-model.md
2. **Beads Query Hints** - Ready-to-use `bd list`, `bd ready`, `bd dep tree` commands  
3. **Phases Structure** - Status icons (⬜ 🔄 ✅), dates, closed task lists
4. **Tasks** - Format: `- [ ] T001 [P] Description \`path/file.ts\``
   - `[P]` = parallelizable (no blocking deps)
   - Every task lists concrete file paths

## Convert tasks.md to Beads Issues

```bash
# Create epic
EPIC=$(bd create "Feature: {name}" -t epic -p 1 -l "spec:{feature}" --json | jq -r '.id')

# Create phase
PHASE=$(bd create "Phase 1: Setup" -t feature -p 1 -l "spec:{feature},phase:setup" --parent $EPIC --json | jq -r '.id')

# Create tasks
bd create "T001: {desc}" -t task -p 2 -l "spec:{feature},phase:setup" --parent $PHASE

# Add dependencies
bd dep add {child} {blocker}
```

**Labels**: `spec:{feature}`, `phase:{name}`, `component:{name}`, `parallel:true`

## Implementation Tracking

`/speckit.implement` does NOT auto-update beads. Track manually:

```bash
# Before task
bd update {id} --status in_progress

# After success  
bd close {id} --reason "Implemented {file}"

# If blocked
bd update {id} --status blocked
bd comment {id} "Blocked: {reason}"

# End of session (CRITICAL)
bd sync
```

Update tasks.md: `- [x] T001 ... - ✅ **COMPLETED** (YYYY-MM-DD)`

## Session Management

**Start:**
```bash
git pull && bd sync && bd prime
bd list --label 'spec:{feature}' --status in_progress
bd ready
```

**End (CRITICAL):**
```bash
bd sync
git add . && git commit -m "{message}" && git push
```

## References

- `references/tasks-template.md` - Complete bd-ready tasks.md template
- `references/beads-commands.md` - Query patterns and automation scripts
- `references/phase-patterns.md` - Real-world phase structure examples
