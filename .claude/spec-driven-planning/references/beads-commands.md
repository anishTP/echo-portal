# Beads Commands Reference

## Core Commands

| Command | Purpose |
|---------|---------|
| `bd ready` | Unblocked tasks |
| `bd list --label X` | Filter by label |
| `bd dep tree {id}` | View dependencies |
| `bd update {id} --status X` | Change status |
| `bd close {id} --reason "..."` | Complete task |
| `bd comment {id} "..."` | Add note |
| `bd sync` | Persist to git |

## Feature Queries

```bash
# All open tasks
bd list --label 'spec:{feature}' --status open

# By phase
bd list --label 'phase:setup' --label 'spec:{feature}'

# By component  
bd list --label 'component:webapp' --label 'spec:{feature}'

# Ready tasks (JSON for scripting)
bd ready --json | jq '.[] | select(.labels // [] | contains(["spec:{feature}"]))'

# Task details
bd show {id}
bd comments {id}
```

## Status Updates

```bash
# Start task
bd update {id} --status in_progress

# Complete
bd close {id} --reason "Implemented {file}"

# Block
bd update {id} --status blocked
bd comment {id} "Blocked: {reason}"

# Discovered work
bd create "Found: {issue}" -t task --deps discovered-from:{parent-id}
```

## Session Scripts

### Start Session
```bash
git pull
bd sync
bd prime
bd list --label 'spec:{feature}' --status in_progress
bd ready
```

### End Session
```bash
bd sync
git add .
git commit -m "{message}"
git push
```

### Track Task (scripts/bd-track.sh)
```bash
#!/bin/bash
case $1 in
  start) bd update "$2" --status in_progress ;;
  done)  bd close "$2" --reason "${3:-Completed}" && bd sync ;;
  block) bd update "$2" --status blocked && bd comment "$2" "Blocked: ${3:-No reason}" ;;
esac
```

### Generate Status Report
```bash
#!/bin/bash
FEATURE="$1"
echo "=== $FEATURE Status ==="
echo "Open: $(bd list --label "spec:$FEATURE" --status open --json | jq length)"
echo "In Progress: $(bd list --label "spec:$FEATURE" --status in_progress --json | jq length)"
echo "Closed: $(bd list --label "spec:$FEATURE" --status closed --json | jq length)"
```

## Label Convention

| Type | Format | Example |
|------|--------|---------|
| Feature | `spec:{name}` | `spec:010-auth` |
| Phase | `phase:{name}` | `phase:setup` |
| Component | `component:{name}` | `component:webapp` |
| Parallel | `parallel:true` | For `[P]` tasks |
