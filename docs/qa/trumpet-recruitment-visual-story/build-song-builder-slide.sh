#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
old="$repo/public/showcases/trumpet-trainer/c19989a3/social/slide-07.png"
source="$repo/docs/qa/trumpet-recruitment-visual-story/source/after-1062.png"
output="$repo/public/showcases/trumpet-trainer/a558583a/social/slide-07.png"
# Preserve the approved navy copy and gold frame. Replace only the older
# Song Builder picture inside that frame with a ratio-preserving crop of the
# exact production capture (x=180..881, all 1070 source rows).
ffmpeg -hide_banner -loglevel error -y -i "$old" -i "$source" \
  -filter_complex '[0:v]drawbox=x=456:y=52:w=590:h=1232:color=0x6442d5:t=fill[base];[1:v]crop=702:1070:180:0,scale=590:900:flags=lanczos[shot];[base][shot]overlay=x=456:y=210:format=auto,format=rgb24[out]' \
  -map '[out]' -frames:v 1 -update 1 "$output"
