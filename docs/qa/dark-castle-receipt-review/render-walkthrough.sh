#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

for number in 01 02 03 04 05 06; do
  ffmpeg -hide_banner -loglevel error -y \
    -i "desktop-${number}.png" -i "mobile-${number}.png" \
    -filter_complex "color=c=#101b30:s=1920x1080[base];[0:v]scale=1400:788[desktop];[1:v]scale=499:1080[mobile];[base][desktop]overlay=x=10:y=146[withdesktop];[withdesktop][mobile]overlay=x=1411:y=0[out]" \
    -map '[out]' -frames:v 1 "slide-${number}.png"
done

ffmpeg -hide_banner -loglevel error -y -framerate 1/3 -i 'slide-%02d.png' \
  -vf 'fps=30,format=yuv420p' -c:v libx264 -preset medium -crf 19 \
  -movflags +faststart walkthrough.mp4
