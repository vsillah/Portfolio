#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# All inputs are browser captures of the exact local review route. No provider media.
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t 3 -i desktop-viewport.png \
  -loop 1 -t 3 -i frame-l05.png \
  -loop 1 -t 3 -i frame-l08.png \
  -loop 1 -t 3 -i frame-l11.png \
  -loop 1 -t 3 -i frame-l16.png \
  -loop 1 -t 3 -i mobile-frame-l16.png \
  -filter_complex '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];[2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v2];[3:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v3];[4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v4];[5:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v5];[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[v]' \
  -map '[v]' -r 30 -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart review-walkthrough.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 review-walkthrough.mp4
