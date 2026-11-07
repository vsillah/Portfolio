#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

ffmpeg -loglevel error -y -loop 1 -t 4 -i 01-desktop.png \
  -vf 'scale=1920:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=0x101c31,fps=24,format=yuv420p' \
  -c:v libx264 -preset medium -crf 21 "$workdir/desktop.mp4"
ffmpeg -loglevel error -y -loop 1 -t 4 -i 02-mobile.png \
  -vf 'scale=555:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=0x101c31,fps=24,format=yuv420p' \
  -c:v libx264 -preset medium -crf 21 "$workdir/mobile.mp4"
printf "file '%s/desktop.mp4'\nfile '%s/mobile.mp4'\n" "$workdir" "$workdir" > "$workdir/segments.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$workdir/segments.txt" -c copy -movflags +faststart agentified-member-dashboard-f2c5d612.mp4
