#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vambahsillah/Projects/Portfolio/agentified"
GEN_PROMPT="$ROOT/prompts/fable5-expanded-outline-generation.md"
OUT="$ROOT/drafts/agentified-expanded-outline-fable5-v1.md"
LOG="$ROOT/drafts/fable5-outline-generation.log"

mkdir -p "$ROOT/drafts" "$ROOT/reviews"

cd "$ROOT"

echo "Running Fable 5 expanded outline generation..."
echo "Prompt: $GEN_PROMPT"
echo "Output: $OUT"

set +e
claude --agent "Fable 5" -p "$(cat "$GEN_PROMPT")" 2>&1 | tee "$OUT" "$LOG" >/dev/null
STATUS=${PIPESTATUS[0]}
set -e

if [[ "$STATUS" -ne 0 ]]; then
  echo "Fable 5 generation failed with exit code $STATUS. Check $LOG for details." >&2
  exit "$STATUS"
fi

if [[ ! -s "$OUT" ]]; then
  echo "Fable 5 did not create $OUT. Check $LOG for details." >&2
  exit 1
fi

if rg -q "Failed to authenticate|API Error|Invalid authentication|Error:" "$OUT"; then
  echo "Fable 5 returned an error. Check $LOG for details." >&2
  exit 1
fi

echo "Fable 5 draft created: $OUT"
echo "Next step: ask Codex to review $OUT using prompts/codex-outline-review-rubric.md"
