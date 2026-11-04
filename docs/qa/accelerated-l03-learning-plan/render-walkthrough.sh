#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
frames=(01-l03-ready 02-l03-player 02b-l03-transcript 03-return 04-l04-locked 05-mobile-player)
for i in "${!frames[@]}"; do
  ffmpeg -hide_banner -loglevel error -y -loop 1 -t 4 -i "$here/${frames[$i]}.png" \
    -vf 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#101b2d,format=yuv420p' \
    -r 24 -c:v libx264 -preset medium -crf 22 "$tmp/$i.mp4"
  printf "file '%s/%s.mp4'\n" "$tmp" "$i" >> "$tmp/list.txt"
done
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy -movflags +faststart "$here/l03-learning-plan-walkthrough.mp4"
ffprobe -v error -show_entries format=duration -of default=nw=1 "$here/l03-learning-plan-walkthrough.mp4"
