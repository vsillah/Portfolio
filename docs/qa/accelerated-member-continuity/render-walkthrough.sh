#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p rendered
frames=(01-guest 02-guest-complete 03-member 04-assessed 05-paid 06-paid-client-work 07-paid-details 08-paid-mobile-details 09-review-pending 10-review-approved)
for frame in "${frames[@]}"; do
  ffmpeg -hide_banner -loglevel error -y -i "$frame.png" -vf 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x101a30' "rendered/$frame.png"
done
: > rendered/frames.txt
for frame in "${frames[@]}"; do
  printf "file '%s.png'\nduration 3\n" "$frame" >> rendered/frames.txt
done
printf "file '%s.png'\n" "10-review-approved" >> rendered/frames.txt
ffmpeg -hide_banner -loglevel error -y -safe 0 -f concat -i rendered/frames.txt -vf 'fps=24,format=yuv420p' -c:v libx264 -preset slow -crf 13 -movflags +faststart accelerated-member-continuity-walkthrough.mp4
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 accelerated-member-continuity-walkthrough.mp4
