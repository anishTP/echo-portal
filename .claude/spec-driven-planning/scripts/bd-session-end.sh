#!/bin/bash
# bd-session-end.sh - Run at end of every session
# Usage: ./bd-session-end.sh

echo "=== End of Session ==="

# Check in-progress tasks
IN_PROGRESS=$(bd list --status in_progress --json 2>/dev/null | jq length)
if [ "$IN_PROGRESS" -gt 0 ]; then
  echo ""
  echo "⚠ $IN_PROGRESS tasks still in progress:"
  bd list --status in_progress --json | jq -r '.[] | "  - \(.id): \(.title)"'
fi

# Sync beads
echo ""
echo "Syncing beads..."
bd sync

# Git status
echo ""
git status --short

read -p "Commit and push? (y/n) " do_git
if [ "$do_git" = "y" ]; then
  read -p "Commit message: " msg
  git add .
  git commit -m "$msg"
  git push
fi

echo ""
echo "✓ Session ended"
