#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -f concat -safe 0 -i tablet.frames.txt \
  -vf 'scale=758:888:flags=lanczos,format=yuv420p' -r 25 \
  -c:v libx264 -crf 22 -preset medium -movflags +faststart \
  tablet-walkthrough.mp4
ffmpeg -y -loglevel error -f concat -safe 0 -i mobile.frames.txt \
  -vf 'scale=760:1644:flags=lanczos,format=yuv420p' -r 25 \
  -c:v libx264 -crf 22 -preset medium -movflags +faststart \
  mobile-walkthrough.mp4
