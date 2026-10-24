#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t 4 -i 00-desktop-overview.jpg \
  -loop 1 -t 4 -i 01-desktop-recovery.jpg \
  -loop 1 -t 4 -i 02-desktop-copy.jpg \
  -loop 1 -t 4 -i 05-desktop-youtube.jpg \
  -loop 1 -t 4 -i 00-phone-overview.jpg \
  -loop 1 -t 4 -i 03-phone-recovery.jpg \
  -loop 1 -t 4 -i 04-phone-copy.jpg \
  -loop 1 -t 4 -i 06-phone-youtube.jpg \
  -filter_complex "[0:v]scale=1440:900,setsar=1[v0];[1:v]scale=1440:900,setsar=1[v1];[2:v]scale=1440:900,setsar=1[v2];[3:v]scale=1440:900,setsar=1[v3];[4:v]scale=390:844:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x101827,setsar=1[v4];[5:v]scale=390:844:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x101827,setsar=1[v5];[6:v]scale=390:844:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x101827,setsar=1[v6];[7:v]scale=390:844:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x101827,setsar=1[v7];[v0][v1][v2][v3][v4][v5][v6][v7]concat=n=8:v=1:a=0[v]" \
  -map '[v]' -r 24 -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart recovery-walkthrough.mp4
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,nb_frames -of default=noprint_wrappers=1 recovery-walkthrough.mp4
