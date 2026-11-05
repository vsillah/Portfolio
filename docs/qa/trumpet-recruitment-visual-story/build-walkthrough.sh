#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
index=0
for frame in "$root"/frames/*.png; do
  index=$((index + 1))
  clip="$tmp/$(printf '%02d' "$index").mp4"
  ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i "$frame" -t 1.6 \
    -vf 'scale=1280:1100:force_original_aspect_ratio=decrease,pad=1280:1100:(ow-iw)/2:(oh-ih)/2:color=0x101a2b' \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 24 "$clip"
  printf "file '%s'\n" "$clip" >> "$tmp/list.txt"
done
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy -movflags +faststart "$root/trumpet-recruitment-persona-sheets-5bd9e104.mp4"
mobile_index=0
for frame in "$root"/frames/{15..22}-*.png "$root"/frames/{25..26}-*.png; do
  mobile_index=$((mobile_index + 1))
  clip="$tmp/mobile-$(printf '%02d' "$mobile_index").mp4"
  ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 24 -i "$frame" -t 1.6 \
    -vf 'scale=360:1080:force_original_aspect_ratio=decrease,pad=360:1080:(ow-iw)/2:(oh-ih)/2:color=0x101a2b' \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 24 "$clip"
  printf "file '%s'\n" "$clip" >> "$tmp/mobile-list.txt"
done
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$tmp/mobile-list.txt" -c copy -movflags +faststart "$root/trumpet-recruitment-persona-sheets-mobile-5bd9e104.mp4"
