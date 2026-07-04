#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vambahsillah/Projects/Portfolio/agentified"
OUTLINE="$ROOT/drafts/agentified-expanded-outline-v2-reviewed.md"
BRIEF="$ROOT/prompts/fable5-first-draft-generation.md"
OUTDIR="$ROOT/manuscript/first-draft/chapters"
LOGDIR="$ROOT/manuscript/first-draft/logs"

mkdir -p "$OUTDIR" "$LOGDIR"

chapter_section() {
  local chapter="$1"
  awk -v needle="### Chapter ${chapter}:" '
    $0 ~ needle {printing=1}
    printing && $0 ~ /^### Chapter [0-9]+:/ && $0 !~ needle {exit}
    printing {print}
  ' "$OUTLINE"
}

slugify() {
  printf "%s" "$1" \
    | tr "[:upper:]" "[:lower:]" \
    | sed -E "s/[^a-z0-9]+/-/g; s/^-+//; s/-+$//"
}

draft_one() {
  local chapter="$1"
  local title="$2"
  local section
  section="$(chapter_section "$chapter")"

  if [[ -z "$section" ]]; then
    echo "Missing outline section for chapter $chapter" >&2
    return 1
  fi

  local slug
  slug="$(slugify "$title")"
  local outfile="$OUTDIR/ch$(printf "%02d" "$chapter")-$slug.md"
  local logfile="$LOGDIR/ch$(printf "%02d" "$chapter")-$slug.log"

  if [[ -s "$outfile" && "${FORCE:-0}" != "1" ]]; then
    echo "skip chapter $chapter: $outfile"
    return 0
  fi

  local prompt
  prompt="$(cat "$BRIEF")

Draft Chapter $chapter of Agentified.

Chapter title: $title

Use this exact reviewed chapter outline:

$section

Return only the chapter manuscript in Markdown.
Start with: ## Chapter $chapter: $title
Do not include process notes, alternatives, caveats, or a summary."

  echo "draft chapter $chapter: $title"
  set +e
  claude --agent "Fable 5" -p "$prompt" > "$outfile.tmp" 2> "$logfile"
  local status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    rm -f "$outfile.tmp"
    echo "Claude/Fable failed for chapter $chapter. See $logfile" >&2
    return "$status"
  fi

  if rg -n "Invalid authentication|API Error|401|Error:" "$outfile.tmp" "$logfile" >/dev/null 2>&1; then
    rm -f "$outfile.tmp"
    echo "Claude/Fable returned an auth or API error for chapter $chapter. See $logfile" >&2
    return 1
  fi

  local words
  words="$(wc -w < "$outfile.tmp" | tr -d " ")"
  if [[ "$words" -lt 600 ]]; then
    rm -f "$outfile.tmp"
    echo "Chapter $chapter output too short ($words words). See $logfile" >&2
    return 1
  fi

  mv "$outfile.tmp" "$outfile"
  echo "wrote $outfile ($words words)"
}

draft_safety_note() {
  local outfile="$OUTDIR/ch00-critical-note-on-agent-safety.md"
  local logfile="$LOGDIR/ch00-critical-note-on-agent-safety.log"

  if [[ -s "$outfile" && "${FORCE:-0}" != "1" ]]; then
    echo "skip safety note: $outfile"
    return 0
  fi

  local prompt
  prompt="$(cat "$BRIEF")

Draft the opening safety note for Agentified.

Working title: A critical note on agent safety

Purpose:
- Establish that agentic systems need governance before scale.
- Make clear that this book is not arguing for unchecked autonomy.
- Explain the boundary between agents that prepare work and humans who approve consequential action.
- Set the tone: practical, moral, grounded, product-oriented.

Return only the manuscript section in Markdown.
Start with: ## A critical note on agent safety
Target 700 to 1,100 words."

  echo "draft safety note"
  set +e
  claude --agent "Fable 5" -p "$prompt" > "$outfile.tmp" 2> "$logfile"
  local status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    rm -f "$outfile.tmp"
    echo "Claude/Fable failed for safety note. See $logfile" >&2
    return "$status"
  fi

  if rg -n "Invalid authentication|API Error|401|Error:" "$outfile.tmp" "$logfile" >/dev/null 2>&1; then
    rm -f "$outfile.tmp"
    echo "Claude/Fable returned an auth or API error for safety note. See $logfile" >&2
    return 1
  fi

  local words
  words="$(wc -w < "$outfile.tmp" | tr -d " ")"
  if [[ "$words" -lt 400 ]]; then
    rm -f "$outfile.tmp"
    echo "Safety note output too short ($words words). See $logfile" >&2
    return 1
  fi

  mv "$outfile.tmp" "$outfile"
  echo "wrote $outfile ($words words)"
}

draft_safety_note

draft_one 1 "The First Receipt"
draft_one 2 "Agents Need Jobs Not Vibes"
draft_one 3 "Start With The Decision"
draft_one 4 "The Trace Harness"
draft_one 5 "Data Safety Becomes Source Safety"
draft_one 6 "From Feedback To Memory"
draft_one 7 "The Controller Brain"
draft_one 8 "The Operating Map"
draft_one 9 "The Permission Slip"
draft_one 10 "The Priority Trap Returns"
draft_one 11 "PRDs For Agents"
draft_one 12 "Swarms Need Org Charts"
draft_one 13 "Handoffs Are Product Interfaces"
draft_one 14 "The Evaluation Loop"
draft_one 15 "Metrics That Matter For Agents"
draft_one 16 "Human Review Is The Trust Layer"
draft_one 17 "Money Needs A Gate"
draft_one 18 "The Decision Theater Rebuilt"
draft_one 19 "Mission Control"
draft_one 20 "Slack Is The Unblock Lane"
draft_one 21 "Client-Safe Proof"
draft_one 22 "The Mobile Foundry Test"
draft_one 23 "AutoResearch Without Autonomy Theater"
draft_one 24 "The Board Demo"
draft_one 25 "The Agentified Day"
draft_one 26 "What Comes Next"
