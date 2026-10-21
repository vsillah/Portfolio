#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
frames=(desktop-blocked mobile-receipts mobile-intake)
for frame in "${frames[@]}"; do
  ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -t 4 -i "${frame}.png" \
    -vf 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x101827,format=yuv420p' \
    -c:v libx264 -preset medium -crf 20 -movflags +faststart "${frame}.mp4"
done
printf "file 'desktop-blocked.mp4'\nfile 'mobile-receipts.mp4'\nfile 'mobile-intake.mp4'\n" > frames.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt -c copy -movflags +faststart official-public-signal-walkthrough.mp4
