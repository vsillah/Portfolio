#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vambahsillah/Projects/Portfolio/agentified"
BRIEF="$ROOT/prompts/fable5-second-draft-revision.md"
REVIEW="$ROOT/manuscript/first-draft/codex-first-draft-review.md"
OUTLINE="$ROOT/drafts/agentified-expanded-outline-v2-reviewed.md"
INDIR="$ROOT/manuscript/first-draft/chapters"
OUTDIR="$ROOT/manuscript/second-draft/chapters"
LOGDIR="$ROOT/manuscript/second-draft/logs"

mkdir -p "$OUTDIR" "$LOGDIR"

chapter_section() {
  local chapter="$1"
  awk -v needle="### Chapter ${chapter}:" '
    $0 ~ needle {printing=1}
    printing && $0 ~ /^### Chapter [0-9]+:/ && $0 !~ needle {exit}
    printing {print}
  ' "$OUTLINE"
}

target_note() {
  local basename="$1"
  case "$basename" in
    ch00-critical-note-on-agent-safety.md)
      printf "%s" "Revise as an author safety note. Keep first-person voice if it feels authentic, but add a concise composite-scene boundary: named client/customer scenes in this draft are fictional or composite unless explicitly identified later. Keep the note practical, not legalistic."
      ;;
    ch08-the-operating-map.md)
      printf "%s" "This closes Act I. Strengthen the transition from harness to authority. The reader should feel that visibility has been solved enough to ask what agents are allowed to do next."
      ;;
    ch18-the-decision-theater-rebuilt.md)
      printf "%s" "This closes Act II. Strengthen the transition from authority to organization. The reader should feel that permissions, evaluations, review, and spend gates now need an operating rhythm."
      ;;
    ch20-slack-is-the-unblock-lane.md)
      printf "%s" "Trim this chapter meaningfully. Target 1,350 to 1,650 words. Keep Slack as an unblock lane, not an approval bypass. Make mobile risk and human authority very clear."
      ;;
    ch24-the-board-demo.md)
      printf "%s" "Preserve Shaka as router/Chief of Staff only. Do not assign Shaka outbound or sales work. Keep board-demo details structural and avoid fake precision."
      ;;
    ch26-what-comes-next.md)
      printf "%s" "Make the ending land as a sequel to \"Accelerated.\" It should feel like the next operating discipline, not a generic future-of-AI conclusion."
      ;;
    *)
      printf "%s" "Apply the general second-draft priorities. Preserve the chapter's core content while tightening voice, transitions, authority gates, and ending."
      ;;
  esac
}

revise_one() {
  local infile="$1"
  local basename
  basename="$(basename "$infile")"
  local outfile="$OUTDIR/$basename"
  local logfile="$LOGDIR/${basename%.md}.log"

  if [[ -s "$outfile" && "${FORCE:-0}" != "1" ]]; then
    echo "skip $basename: $outfile"
    return 0
  fi

  local heading
  heading="$(sed -n '1p' "$infile")"

  local outline_section=""
  if [[ "$basename" =~ ^ch([0-9][0-9])- ]]; then
    local chapter_number="${BASH_REMATCH[1]#0}"
    if [[ "$chapter_number" != "0" ]]; then
      outline_section="$(chapter_section "$chapter_number")"
    fi
  fi

  local prompt
  prompt="$(cat "$BRIEF")

First-draft review context:

$(cat "$REVIEW")

Specific revision target for this section:

$(target_note "$basename")

Reviewed outline context, if applicable:

$outline_section

Revise this manuscript section into a stronger second draft.

Keep the opening heading exactly:
$heading

First draft section:

$(cat "$infile")"

  echo "revise $basename"
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
    echo "Second draft output too short for $basename ($words words). See $logfile" >&2
    return 1
  fi

  mv "$outfile.tmp" "$outfile"
  echo "wrote $outfile ($words words)"
}

for file in "$INDIR"/ch*.md; do
  revise_one "$file"
done
