#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

render_still() {
  local input="$1"
  local output="$2"
  ffmpeg -loglevel error -y -loop 1 -framerate 30 -i "$input" -t 4 \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x102a33,format=yuv420p" \
    -c:v libx264 -r 30 "$output"
}

render_still "$root/profile-name-prefill.png" "$work/prefill.mp4"
render_still "$root/approved-frame-desktop.png" "$work/desktop.mp4"
render_still "$root/approved-frame-mobile.png" "$work/mobile.mp4"
render_still "$root/approved-frame-download.png" "$work/download.mp4"

printf "file '%s'\nfile '%s'\nfile '%s'\nfile '%s'\n" \
  "$work/prefill.mp4" "$work/desktop.mp4" "$work/mobile.mp4" "$work/download.mp4" > "$work/concat.txt"

ffmpeg -loglevel error -y -f concat -safe 0 -i "$work/concat.txt" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  "$root/certificate-approved-frame-walkthrough.mp4"
