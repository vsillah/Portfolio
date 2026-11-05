#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -y -hide_banner -loglevel error -framerate 3 \
  -i continuous-frames/frame-%05d.jpg \
  -vf 'scale=1260:794:force_original_aspect_ratio=decrease,pad=1260:794:(ow-iw)/2:(oh-ih)/2' \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -movflags +faststart \
  worksheet-walkthrough.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 worksheet-walkthrough.mp4
