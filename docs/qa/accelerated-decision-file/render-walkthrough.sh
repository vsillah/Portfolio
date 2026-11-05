#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -y -v error \
  -loop 1 -framerate 24 -t 3 -i desktop-worksheet.png \
  -loop 1 -framerate 24 -t 3 -i mobile-worksheet.png \
  -loop 1 -framerate 24 -t 3 -i desktop-share-preview.png \
  -loop 1 -framerate 24 -t 3 -i mobile-share-blocked.png \
  -loop 1 -framerate 24 -t 3 -i desktop-local-fixture-receipt.png \
  -loop 1 -framerate 24 -t 3 -i operator-auth-gate.png \
  -filter_complex '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[a];[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[b];[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[c];[3:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[d];[4:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[e];[5:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1822,setsar=1[f];[a][b][c][d][e][f]concat=n=6:v=1:a=0,format=yuv420p[out]' \
  -map '[out]' -r 24 -c:v libx264 -preset fast -crf 23 -movflags +faststart worksheet-walkthrough.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 worksheet-walkthrough.mp4
