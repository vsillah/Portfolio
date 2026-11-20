#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
output="$root/agentified/workshop/phase-3b-review/contextual"
mkdir -p "$output"

# These clips preserve contextual teaching/ending windows for captain media QA.
# They are not browser screen recordings and are not the Human QA artifact.
render() {
  local id="$1" source="$2" vtt="$3" start="$4" length="$5" layout="$6" filter="$7"
  local scratch
  scratch="$(mktemp -d)"
  python3 "$root/docs/agentified-distribution-readiness/phase-3b/trim_vtt.py" "$vtt" "$output/${id}-${layout}-context.vtt" "$start" "$length"
  ffmpeg -y -hide_banner -loglevel error -ss "$start" -i "$source" -t "$length" \
    -map 0:v:0 -map 0:a:0 -vf "$filter" \
    -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart "$scratch/video.mp4"
  ffmpeg -y -hide_banner -loglevel error -i "$scratch/video.mp4" -i "$output/${id}-${layout}-context.vtt" \
    -map 0:v:0 -map 0:a:0 -map 1:0 -c copy -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default -movflags +faststart \
    "$output/${id}-${layout}-context.mp4"
  rm -rf "$scratch"
}

l01="$root/public/agentified/lessons/l01/illustrated-1eeaa68b/agentified-l01-illustrated-composite.mp4"
l10="$root/agentified/workshop/phase-3b-review/L10/agentified-l10-caption-timed-composite.mp4"
l16="$root/agentified/workshop/phase-3b-review/L16/agentified-l16-resting-composite.mp4"
l02="$root/public/agentified/lessons/l02/illustrated-27a72885/agentified-l02-illustrated-composite.mp4"
l01_vtt="$root/public/agentified/lessons/l01/continuous-10f9ea26/agentified-l01-continuous-narration-captions.vtt"
l10_vtt="$root/agentified/workshop/phase-3b-review/L10/agentified-l10-caption-timed.vtt"
l16_vtt="$root/public/agentified/lessons/l16/approved-e890f6a9/agentified-l16-native-captions.vtt"
l02_vtt="$root/public/agentified/lessons/l02/corrected-e2b5ecbc/agentified-l02-native-captions.vtt"

for layout in desktop mobile; do
  if [[ "$layout" == desktop ]]; then filter='scale=1280:720'; else filter='scale=390:219,pad=390:844:0:312:color=0x071b2a'; fi
  render L01 "$l01" "$l01_vtt" 349 29.28 "$layout" "$filter"
  render L01-setup "$l01" "$l01_vtt" 0 30 "$layout" "$filter"
  render L10 "$l10" "$l10_vtt" 166 30 "$layout" "$filter"
  render L10-teaching "$l10" "$l10_vtt" 120 30 "$layout" "$filter"
  render L16 "$l16" "$l16_vtt" 247 28.32 "$layout" "$filter"
  render L16-guided "$l16" "$l16_vtt" 202 30 "$layout" "$filter"
  render L02-adjacent "$l02" "$l02_vtt" 0 12 "$layout" "$filter"
done

printf 'Rendered fourteen contextual media clips under %s\n' "$output"
