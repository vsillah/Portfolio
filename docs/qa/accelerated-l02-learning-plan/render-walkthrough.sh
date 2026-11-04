#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t 4 -i desktop-l01-player.png \
  -loop 1 -t 4 -i desktop-l02-ready.png \
  -loop 1 -t 5 -i desktop-l02-playing.png \
  -loop 1 -t 4 -i desktop-l02-transcript.png \
  -loop 1 -t 4 -i desktop-l02-return.png \
  -loop 1 -t 4 -i desktop-l03-locked.png \
  -filter_complex '[0:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];[1:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];[2:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v2];[3:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v3];[4:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v4];[5:v]fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v5];[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0,format=yuv420p[out]' \
  -map '[out]' -c:v libx264 -crf 21 -preset medium -movflags +faststart accelerated-l02-learning-plan-walkthrough.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames -show_entries format=duration -of default=noprint_wrappers=1 accelerated-l02-learning-plan-walkthrough.mp4
