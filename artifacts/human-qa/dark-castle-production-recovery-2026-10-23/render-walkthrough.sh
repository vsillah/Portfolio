#!/bin/sh
set -eu
cd "$(dirname "$0")"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt \
  -vf 'scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,format=yuv420p' \
  -r 30 -c:v libx264 -crf 19 -preset medium -movflags +faststart recovery-walkthrough.mp4
