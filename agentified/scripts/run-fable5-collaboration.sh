#!/usr/bin/env bash
set -euo pipefail

PORTFOLIO_ROOT="/Users/vambahsillah/Projects/Portfolio"
ROOT="$PORTFOLIO_ROOT/agentified"
SYSTEM_PROMPT="$ROOT/prompts/fable5-collaboration-system.md"
TASK_PROMPT="${1:-$ROOT/prompts/fable5-source-smoke.md}"
RUN_LABEL="${2:-fable5-receipt}"
OUTDIR="$ROOT/collaboration/claude-fable5/runs"

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI was not found on PATH." >&2
  exit 1
fi

if [[ ! -f "$SYSTEM_PROMPT" ]]; then
  echo "Missing system prompt: $SYSTEM_PROMPT" >&2
  exit 1
fi

if [[ ! -f "$TASK_PROMPT" ]]; then
  echo "Missing task prompt: $TASK_PROMPT" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_LABEL="$(basename "$RUN_LABEL" | tr -cd 'A-Za-z0-9._-')"
OUT="$OUTDIR/$STAMP-$SAFE_LABEL.md"
ERR="$OUTDIR/$STAMP-$SAFE_LABEL.err"

cd "$PORTFOLIO_ROOT"

CLAUDE_CMD=(
  claude
  --name "Agentified Fable 5"
  --append-system-prompt "$(cat "$SYSTEM_PROMPT")"
  --tools "Read,Grep,Glob"
  --permission-mode dontAsk
  --no-session-persistence
)

if [[ -n "${CLAUDE_MODEL:-}" ]]; then
  CLAUDE_CMD+=(--model "$CLAUDE_MODEL")
fi

CLAUDE_CMD+=(-p "$(cat "$TASK_PROMPT")")

echo "Running Fable 5 collaboration prompt..."
echo "Task: $TASK_PROMPT"
echo "Output: $OUT"

set +e
"${CLAUDE_CMD[@]}" > "$OUT.tmp" 2> "$ERR"
STATUS=$?
set -e

if [[ "$STATUS" -ne 0 ]]; then
  rm -f "$OUT.tmp"
  echo "Fable 5 collaboration run failed with exit code $STATUS. See $ERR" >&2
  exit "$STATUS"
fi

if [[ ! -s "$OUT.tmp" ]]; then
  rm -f "$OUT.tmp"
  echo "Fable 5 returned an empty response. See $ERR" >&2
  exit 1
fi

if rg -n "Invalid authentication|Failed to authenticate|API Error|401|Error:" "$OUT.tmp" "$ERR" >/dev/null 2>&1; then
  rm -f "$OUT.tmp"
  echo "Fable 5 returned an auth or API error. See $ERR" >&2
  exit 1
fi

mv "$OUT.tmp" "$OUT"
echo "Wrote Fable 5 receipt: $OUT"
