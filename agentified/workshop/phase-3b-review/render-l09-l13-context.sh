#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$root"
render() {
  local lesson="$1" input="$2" vtt="$3" start="$4" duration="$5" layout="$6"
  local out="agentified/workshop/phase-3b-review/$lesson/context"
  mkdir -p "$out"
  python3 docs/agentified-distribution-readiness/phase-3b/trim_vtt.py "$vtt" "$out/${lesson}-${layout}-context.vtt" "$start" "$duration"
  local filter
  if [[ "$layout" == desktop ]]; then
    filter="scale=1280:720"
  else
    filter="scale=390:219,pad=390:844:0:312:color=0x071b2a"
  fi
  ffmpeg -y -hide_banner -loglevel error -ss "$start" -i "$input" -i "$out/${lesson}-${layout}-context.vtt" -t "$duration" -vf "$filter" \
    -map 0:v:0 -map 0:a:0 -map 1:0 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default \
    -movflags +faststart "$out/${lesson}-${layout}-context.mp4"
}
l09=agentified/workshop/phase-3b-review/L09/agentified-l09-approved-word-candidate.mp4
l09v=agentified/workshop/phase-3b-review/L09/agentified-l09-approved-word-candidate.vtt
l13=agentified/workshop/phase-3b-review/L13/agentified-l13-unknown-content-aware-candidate.mp4
l13v=public/agentified/lessons/l13/approved-c84cc008/agentified-l13-native-captions.vtt
for layout in desktop mobile; do
  render L09 "$l09" "$l09v" 142 18 "$layout"
  render L13 "$l13" "$l13v" 62 16 "$layout"
done
