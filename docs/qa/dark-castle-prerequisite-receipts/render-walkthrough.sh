#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ffmpeg -hide_banner -loglevel error -y \
  -framerate 1/3 -start_number 1 -i 'desktop-%02d.jpg' \
  -framerate 1/3 -start_number 1 -i 'mobile-%02d.jpg' \
  -filter_complex 'color=c=#101b30:s=1920x1080:r=30[base];[0:v]scale=1400:788,fps=30[desktop];[1:v]scale=499:1080,fps=30[mobile];[base][desktop]overlay=x=10:y=146:shortest=1[withdesktop];[withdesktop][mobile]overlay=x=1411:y=0:shortest=1,format=yuv420p[out]' \
  -map '[out]' -t 18 -c:v libx264 -preset medium -crf 19 \
  -movflags +faststart walkthrough.mp4
