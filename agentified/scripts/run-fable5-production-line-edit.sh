#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vambahsillah/Projects/Portfolio/agentified"
BRIEF="$ROOT/prompts/fable5-production-line-edit.md"
SECOND_DIR="$ROOT/manuscript/second-draft/chapters"
OUTDIR="$ROOT/manuscript/production-draft/chapters"
LOGDIR="$ROOT/manuscript/production-draft/logs"

mkdir -p "$OUTDIR" "$LOGDIR"

# Start from the fully reviewed second draft, then replace selected chapters
# with Fable 5 read-aloud line edits.
for file in "$SECOND_DIR"/ch*.md; do
  cp "$file" "$OUTDIR/$(basename "$file")"
done

line_edit_one() {
  local basename="$1"
  local infile="$SECOND_DIR/$basename"
  local outfile="$OUTDIR/$basename"
  local logfile="$LOGDIR/${basename%.md}.log"
  local heading
  heading="$(sed -n '1p' "$infile")"

  if [[ -s "$outfile" && "${FORCE:-0}" != "1" && -f "$LOGDIR/${basename%.md}.done" ]]; then
    echo "skip $basename: already line edited"
    return 0
  fi

  local focus
  case "$basename" in
    ch01-the-first-receipt.md)
      focus="Make Chapter 1 feel like the true opening chapter after the safety note. Tighten the first scene, make the receipt motif memorable, and keep the final line quotable."
      ;;
    ch08-the-operating-map.md)
      focus="Make Chapter 8 close Act I cleanly. The reader should feel the shift from visibility/harness to the authority question."
      ;;
    ch18-the-decision-theater-rebuilt.md)
      focus="Make Chapter 18 close Act II cleanly. The reader should feel the gates are built, but the operating rhythm is still missing."
      ;;
    ch20-slack-is-the-unblock-lane.md)
      focus="Trim for pace where possible. Keep Slack as an unblock lane, not an approval bypass. Make the mobile-risk argument sharp and practical."
      ;;
    ch25-the-agentified-day.md)
      focus="Make Chapter 25 feel like the destination scene. The Six-Beat Day should feel earned through action, consequence, and reader payoff."
      ;;
    ch26-what-comes-next.md)
      focus="Make Chapter 26 land as the sequel to \"Accelerated.\" End with practical moral force, not generic future-of-AI language."
      ;;
    *)
      focus="General production line edit."
      ;;
  esac

  local prompt
  prompt="$(cat "$BRIEF")

Specific focus for this chapter:

$focus

Keep the opening heading exactly:
$heading

Chapter to line edit:

$(cat "$infile")"

  echo "line edit $basename"
  set +e
  claude --agent "Fable 5" -p "$prompt" > "$outfile.tmp" 2> "$logfile"
  local status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    rm -f "$outfile.tmp"
    echo "Fable 5 failed for $basename. See $logfile" >&2
    return "$status"
  fi

  if rg -n "Invalid authentication|API Error|401|Error:" "$outfile.tmp" "$logfile" >/dev/null 2>&1; then
    rm -f "$outfile.tmp"
    echo "Fable 5 returned an auth or API error for $basename. See $logfile" >&2
    return 1
  fi

  if ! head -n 1 "$outfile.tmp" | grep -Fxq "$heading"; then
    rm -f "$outfile.tmp"
    echo "Fable 5 changed or omitted heading for $basename. See $logfile" >&2
    return 1
  fi

  local words
  words="$(wc -w < "$outfile.tmp" | tr -d " ")"
  if [[ "$words" -lt 500 ]]; then
    rm -f "$outfile.tmp"
    echo "Line edit output too short for $basename ($words words). See $logfile" >&2
    return 1
  fi

  mv "$outfile.tmp" "$outfile"
  touch "$LOGDIR/${basename%.md}.done"
  echo "wrote $outfile ($words words)"
}

line_edit_one "ch01-the-first-receipt.md"
line_edit_one "ch08-the-operating-map.md"
line_edit_one "ch18-the-decision-theater-rebuilt.md"
line_edit_one "ch20-slack-is-the-unblock-lane.md"
line_edit_one "ch25-the-agentified-day.md"
line_edit_one "ch26-what-comes-next.md"
