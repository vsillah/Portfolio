#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

assemble() {
  local output="$1" width="$2" height="$3"
  shift 3
  local index=0 frame clip list="$tmp/${output}.txt"
  : > "$list"
  for frame in "$@"; do
    index=$((index + 1))
    clip="$tmp/${output}-$(printf '%02d' "$index").mp4"
    ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i "$root/$frame" -t 2 \
      -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x101a2b" \
      -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 24 "$clip"
    printf "file '%s'\n" "$clip" >> "$list"
  done
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$list" -c copy -movflags +faststart "$root/$output"
}

assemble trumpet-recruitment-refinement-wide-99ced630.mp4 1280 1100 \
  1280-carousel-first.jpg 1280-carousel-last.jpg 1280-timeline.jpg \
  1062-carousel-first.jpg 1062-carousel-last.jpg 1062-timeline.jpg 1062-timeline-detail.jpg \
  768-carousel-first.jpg 768-carousel-last.jpg 768-timeline.jpg 768-timeline-bottom.jpg

assemble trumpet-recruitment-refinement-mobile-99ced630.mp4 360 1080 \
  360-carousel-first.jpg 360-carousel-last.jpg 360-timeline.jpg 360-timeline-detail.jpg
