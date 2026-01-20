#!/bin/bash
# bd-track.sh - Quick task status updates
# Usage: ./bd-track.sh start|done|block TASK_ID [reason]

ACTION="$1"
TASK_ID="$2"
REASON="$3"

case $ACTION in
  start)
    bd update "$TASK_ID" --status in_progress
    echo "✓ Started: $TASK_ID"
    ;;
  done)
    bd close "$TASK_ID" --reason "${REASON:-Completed}"
    bd sync
    echo "✓ Closed: $TASK_ID"
    ;;
  block)
    bd update "$TASK_ID" --status blocked
    bd comment "$TASK_ID" "Blocked: ${REASON:-No reason given}"
    echo "⚠ Blocked: $TASK_ID"
    ;;
  *)
    echo "Usage: $0 start|done|block TASK_ID [reason]"
    exit 1
    ;;
esac
